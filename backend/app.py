#!/usr/bin/env python3
"""
EV Charging Optimization Backend
Flask API for Los Angeles EV charging optimization
"""

from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import pandas as pd
import numpy as np
import requests
import json
import joblib
import os
from datetime import datetime, timedelta
import traceback
from dotenv import load_dotenv
import googlemaps

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)  # Enable CORS for React frontend

# Configuration
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key')
app.config['DEBUG'] = os.getenv('FLASK_DEBUG', 'False').lower() == 'true'

class EVChargingAPI:
    """Main API class for EV charging optimization"""
    
    def __init__(self):
        self.api_keys = {
            'NREL': os.getenv('NREL_API_KEY'),
            'OPENWEATHER': os.getenv('OPENWEATHER_API_KEY'),
            'GOOGLE_MAPS': os.getenv('GOOGLE_MAPS_API_KEY'),
            'CLAUDE': os.getenv('CLAUDE_API_KEY')
        }
        
        self.la_coords = {'lat': 34.0522, 'lon': -118.2437}
        self.panel_area = 500  # m²
        self.efficiency = 0.17  # 17% effective efficiency
        
        # TOU Rates
        self.los_angeles_dept_water_power_rates = {
            'base_period': 0.22, 'low_peak': 0.223, 'high_peak': 0.37
        }
        self.southern_california_edison_rates = {
            'off_peak': 0.27, 'mid_peak': 0.30, 'on_peak': 0.32
        }
        
        # Load data and models
        self.load_station_data()
        self.load_models()
        
        # Initialize Google Maps client
        if self.api_keys['GOOGLE_MAPS']:
            self.gmaps_client = googlemaps.Client(key=self.api_keys['GOOGLE_MAPS'])
        else:
            self.gmaps_client = None
    
    def load_station_data(self):
        """Load EV station data"""
        try:
            self.la_stations = pd.read_csv('../api_data/los_angeles_ev_stations.csv')
            self.high_capacity_stations = pd.read_csv('../api_data/la_high_capacity_stations.csv')
            
            with open('../config/ev_stations_summary.json', 'r') as f:
                self.station_summary = json.load(f)
            
        except Exception as e:
            print(f"Error loading station data: {e}")
            self.la_stations = pd.DataFrame()
            self.high_capacity_stations = pd.DataFrame()
            self.station_summary = {}
    
    def load_models(self):
        """Load pre-trained ML models"""
        self.models = {}
        self.scaler = None
        
        model_files = {
            'rf_los_angeles_dept_water_power': '../models/random_forest_ladwp_model.pkl',
            'rf_southern_california_edison': '../models/random_forest_sce_model.pkl',
            'xgb_los_angeles_dept_water_power': '../models/xgboost_ladwp_model.pkl',
            'xgb_southern_california_edison': '../models/xgboost_sce_model.pkl',
            'lgb_los_angeles_dept_water_power': '../models/lightgbm_ladwp_model.pkl',
            'lgb_southern_california_edison': '../models/lightgbm_sce_model.pkl',
            'meta_los_angeles_dept_water_power': '../models/meta_learner_ladwp.pkl',
            'meta_southern_california_edison': '../models/meta_learner_sce.pkl'
        }
        
        loaded_count = 0
        for model_name, filepath in model_files.items():
            try:
                self.models[model_name] = joblib.load(filepath)
                loaded_count += 1
            except Exception as e:
                print(f"Warning: Could not load {model_name}: {e}")
        
        try:
            self.scaler = joblib.load('../models/feature_scaler.pkl')
        except Exception as e:
            print(f"Warning: Could not load scaler: {e}")
        
    
    def fetch_current_weather(self, lat=None, lon=None):
        """Fetch current weather from OpenWeatherMap"""
        coords = {'lat': lat or self.la_coords['lat'], 'lon': lon or self.la_coords['lon']}
        
        if not self.api_keys['OPENWEATHER']:
            return self._get_fallback_weather()
        
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {
            'lat': coords['lat'],
            'lon': coords['lon'],
            'appid': self.api_keys['OPENWEATHER'],
            'units': 'imperial'
        }
        
        try:
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return {
                    'temperature': data['main']['temp'],
                    'humidity': data['main']['humidity'],
                    'wind_speed': data['wind']['speed'],
                    'clouds': data['clouds']['all'],
                    'description': data['weather'][0]['description'],
                    'timestamp': datetime.now().isoformat()
                }
        except Exception as e:
            print(f"Weather API error: {e}")
        
        return self._get_fallback_weather()
    
    def _get_fallback_weather(self):
        """Fallback weather data when API is unavailable"""
        month = datetime.now().month
        seasonal_temp_c = 15 + 10 * np.sin((month - 1) * np.pi / 6)
        seasonal_temp_f = seasonal_temp_c * 9/5 + 32
        
        return {
            'temperature': seasonal_temp_f + np.random.normal(0, 3.6),
            'humidity': 65,
            'wind_speed': 3.5 * 2.237,
            'clouds': 20,
            'description': 'partly cloudy',
            'timestamp': datetime.now().isoformat()
        }
    
    def calculate_solar_potential(self, weather_data):
        """Calculate solar generation potential"""
        now = datetime.now()
        hour = now.hour
        month = now.month
        
        # Monthly solar irradiance data for LA area
        monthly_ghi = [3.06, 3.65, 5.15, 6.35, 6.89, 7.24, 
                      7.65, 7.02, 5.79, 4.42, 3.46, 2.82]
        
        base_ghi = monthly_ghi[month-1] * 1000 / 24
        
        # Solar elevation factor
        if hour < 6 or hour > 19:
            solar_factor = 0
        else:
            hour_angle = (hour - 12) * 15
            solar_factor = max(0, np.cos(np.radians(hour_angle)) ** 2)
        
        # Weather adjustment
        cloud_factor = 1 - (weather_data.get('clouds', 0) / 100) * 0.8
        
        # Calculate GHI
        ghi = base_ghi * solar_factor * 2.5 * cloud_factor
        
        # Temperature adjustment for panel efficiency
        temp_f = weather_data.get('temperature', 77)
        temp_c = (temp_f - 32) * 5/9
        temp_factor = 1 + (-0.004) * (temp_c - 25)
        
        # Power generation
        power_kw = (ghi / 1000) * self.panel_area * self.efficiency * temp_factor
        
        return {
            'ghi': ghi,
            'power_kw': max(0, power_kw),
            'hourly_energy_kwh': max(0, power_kw),
            'temp_factor': temp_factor,
            'cloud_factor': cloud_factor
        }
    
    def get_tou_rates(self, hour, is_weekend, utility='ladwp'):
        """Get Time-of-Use rates"""
        if utility == 'ladwp':
            if is_weekend or hour >= 20 or hour < 10:
                return self.ladwp_rates['base_period'], 'base_period'
            elif (10 <= hour < 13) or (17 <= hour < 20):
                return self.ladwp_rates['low_peak'], 'low_peak'
            elif 13 <= hour < 17:
                return self.ladwp_rates['high_peak'], 'high_peak'
            else:
                return self.ladwp_rates['base_period'], 'base_period'
        else:  # Southern California Edison
            if is_weekend or hour < 16 or hour >= 22:
                return self.southern_california_edison_rates['off_peak'], 'off_peak'
            elif (16 <= hour < 18) or (20 <= hour < 22):
                return self.southern_california_edison_rates['mid_peak'], 'mid_peak'
            elif 18 <= hour < 20:
                return self.southern_california_edison_rates['on_peak'], 'on_peak'
            else:
                return self.southern_california_edison_rates['off_peak'], 'off_peak'
    
    def predict_optimization_score(self, dt, weather_data, utility='ladwp'):
        """Predict optimization score using ML models"""
        if not self.models or not self.scaler:
            return 0.5  # Fallback score
        
        # Prepare features
        hour = dt.hour
        day_of_year = dt.timetuple().tm_yday
        month = dt.month
        is_weekend = dt.weekday() >= 5
        
        # Solar data
        solar_data = self.calculate_solar_potential(weather_data)
        ghi = solar_data['ghi']
        dni = ghi * 0.7 if ghi > 100 else 0
        dhi = ghi * 0.3 if ghi > 50 else ghi
        
        # Weather features
        temperature = weather_data.get('temperature', 20)
        wind_speed = weather_data.get('wind_speed', 3.5)
        
        # TOU rates
        los_angeles_dept_water_power_rate, _ = self.get_tou_rates(hour, is_weekend, 'los_angeles_dept_water_power')
        southern_california_edison_rate, _ = self.get_tou_rates(hour, is_weekend, 'southern_california_edison')
        
        # Cyclical features
        hour_sin = np.sin(2 * np.pi * hour / 24)
        hour_cos = np.cos(2 * np.pi * hour / 24)
        day_sin = np.sin(2 * np.pi * day_of_year / 365)
        day_cos = np.cos(2 * np.pi * day_of_year / 365)
        
        features = np.array([
            hour, day_of_year, month, int(is_weekend),
            ghi, dni, dhi, temperature, wind_speed,
            solar_data['hourly_energy_kwh'], los_angeles_dept_water_power_rate, southern_california_edison_rate,
            hour_sin, hour_cos, day_sin, day_cos
        ]).reshape(1, -1)
        
        try:
            # Scale features
            features_scaled = self.scaler.transform(features)
            
            # Use best model (LightGBM)
            model_key = f'lgb_{utility}'
            if model_key in self.models:
                score = self.models[model_key].predict(features_scaled)[0]
                return max(0, min(1, score))
        except Exception as e:
            print(f"Prediction error: {e}")
        
        return 0.5

def get_fallback_response(message, context):
    """Provide helpful responses when Claude API is unavailable"""
    current_time = datetime.now().hour
    current_date = datetime.now()
    is_weekend = current_date.weekday() >= 5
    
    # Extract current conditions if available
    current_conditions = context.get('current_conditions', {})
    weather = current_conditions.get('weather', {})
    solar = current_conditions.get('solar', {})
    pricing = current_conditions.get('pricing', {})
    
    temp_str = f" Currently {weather.get('temperature', 70):.0f}°F" if weather.get('temperature') else ""
    solar_str = f" Solar: {solar.get('power_kw', 0):.1f} kW" if solar.get('power_kw') else ""
    los_angeles_dept_water_power_rate = pricing.get('los_angeles_dept_water_power', {}).get('rate', 0.22)
    southern_california_edison_rate = pricing.get('southern_california_edison', {}).get('rate', 0.27)
    
    # Best time to charge queries
    if any(word in message for word in ['best time', 'when to charge', 'time to charge', 'charge today', 'charge now']):
        if is_weekend:
            if 8 <= current_time <= 18:
                return f"""Best Time to Charge Today (Weekend)

Current Time: {current_date.strftime('%I:%M %p')} - Weekend rates apply!{temp_str}{solar_str}

CHARGE NOW: 
• LA Department of Water and Power: Base Period rate (${los_angeles_dept_water_power_rate:.3f}/kWh) - Best deal!
• Southern California Edison: Off-Peak rate (${southern_california_edison_rate:.3f}/kWh) - Good option

Today's Schedule:
• Now - 8 PM: LA Department of Water and Power Base Period (lowest cost)
• 8 PM - 10 PM: LA Department of Water and Power Low Peak ($0.223/kWh)
• 10 PM onwards: Both utilities at low rates

Weekend Advantage: No peak pricing! Charge anytime for great rates."""
            else:
                return f"""Best Time to Charge Tonight/Tomorrow (Weekend)

Current Time: {current_date.strftime('%I:%M %p')} - Weekend rates

CHARGE NOW: Perfect time!
• LA Department of Water and Power: Base Period ($0.22/kWh) - Lowest rate
• Southern California Edison: Off-Peak ($0.27/kWh)

Weekend Charging Tips:
• No peak pricing penalties
• Charge anytime for consistent low rates
• Best value: LA Department of Water and Power Base Period (8 PM - 10 AM)

Tomorrow: Start charging after 8 PM for maximum savings!"""
        else:
            if 20 <= current_time or current_time < 10:
                return f"""**Perfect Time to Charge! (Weekday)**

**Current Time:** {current_date.strftime('%I:%M %p')} - LA Department of Water and Power Base Period{temp_str}{solar_str}

**CHARGE NOW:**
• **LA Department of Water and Power Base Period:** ${los_angeles_dept_water_power_rate:.3f}/kWh **Lowest rate!**
• **Southern California Edison Off-Peak:** ${southern_california_edison_rate:.3f}/kWh (if on Southern California Edison plan)

**Why charge now?**
• Lowest electricity rates of the day
• Reduced grid demand = cleaner energy
• Save 40-50% vs. peak hours

**Continue until:** 10 AM tomorrow for maximum savings"""
            elif 10 <= current_time < 13:
                return f"""**Current Charging Status (Weekday)**

**Current Time:** {current_date.strftime('%I:%M %p')} - LA Department of Water and Power Low Peak

**Current Rates:**
• LA Department of Water and Power: $0.223/kWh (Low Peak) - Okay to charge
• Southern California Edison: $0.27/kWh (Off-Peak) - Good option

**Better Times Today:**
• **Wait until 8 PM:** LA Department of Water and Power Base Period ($0.22/kWh)
• **Avoid 1-5 PM:** LA Department of Water and Power High Peak ($0.37/kWh)

**Solar Bonus:** If you have solar, charge now for maximum solar utilization!"""
            elif 13 <= current_time < 17:
                return f"""**AVOID CHARGING NOW! (Peak Hours)**

**Current Time:** {current_date.strftime('%I:%M %p')} - LA Department of Water and Power High Peak

**Current Rates:**
• LA Department of Water and Power: $0.37/kWh **Most expensive!**
• Southern California Edison: $0.30/kWh (Mid-Peak) - Still high

**Better Times Today:**
• **Wait until 8 PM:** LA Department of Water and Power Base Period ($0.22/kWh)
• **Or charge now with Southern California Edison** if urgent ($0.30/kWh)

**Save 40%+** by waiting just {20-current_time} hours until base period!"""
            else:  # 17-20
                return f"""**Transition Period - Charge Soon! (Weekday)**

**Current Time:** {current_date.strftime('%I:%M %p')} - LA Department of Water and Power Low Peak

**Current Rates:**
• LA Department of Water and Power: $0.223/kWh (Low Peak) - Acceptable
• Southern California Edison: $0.30/kWh (Mid-Peak) - Higher cost

**Best Time Coming:**
• **In {20-current_time} hours:** LA Department of Water and Power Base Period ($0.22/kWh)
• **Peak avoidance:** You've passed the expensive hours!

**Recommendation:** Wait {20-current_time} more hours for optimal savings!"""
    
    elif any(word in message for word in ['los_angeles_dept_water_power', 'southern_california_edison', 'cost', 'rate', 'compare']):
        if 20 <= current_time or current_time < 10:
            return """LA Department of Water and Power vs Southern California Edison Cost Comparison (Current)

LA Department of Water and Power Rates:
• Base Period (8 PM - 10 AM): $0.22/kWh - Best time to charge
• Low Peak (10 AM - 1 PM, 5-8 PM): $0.223/kWh
• High Peak (1-5 PM): $0.37/kWh - Avoid charging

Southern California Edison Rates:
• Off-Peak (10 PM - 4 PM): $0.27/kWh - Good for charging
• Mid-Peak (4-6 PM, 8-10 PM): $0.30/kWh
• On-Peak (6-8 PM): $0.32/kWh - Avoid charging

Current Recommendation: Charge now with LA Department of Water and Power (Base Period) for lowest costs!"""
        else:
            return """**LA Department of Water and Power vs Southern California Edison Cost Analysis**

**Best Charging Times:**
• LA Department of Water and Power: 8 PM - 10 AM (Base Period) - $0.22/kWh
• Southern California Edison: 10 PM - 4 PM (Off-Peak) - $0.27/kWh

**Avoid These Times:**
• LA Department of Water and Power: 1-5 PM (High Peak) - $0.37/kWh
• Southern California Edison: 6-8 PM (On-Peak) - $0.32/kWh

**Current Time Recommendation:** Wait until 8 PM for LA Department of Water and Power's base rates, or charge now with Southern California Edison if urgent."""
    
    elif any(word in message for word in ['solar', 'sun', 'renewable']):
        if 10 <= current_time <= 16:
            return """**Solar Energy Integration**

**Current Solar Conditions:** Peak generation time!
• Estimated solar power: 15-25 kW
• Perfect time for solar-assisted charging
• Reduce grid dependency by 60-80%

**Solar Charging Benefits:**
• Lower effective charging costs
• Environmental impact reduction
• Grid stress relief during peak hours

**Tip:** Charge now to maximize solar energy utilization!"""
        else:
            return """**Solar Energy Optimization**

**Best Solar Charging:** 10 AM - 4 PM
• Peak solar generation: 12 PM - 2 PM
• Combine with LA Department of Water and Power low peak rates for maximum savings

**Night Charging Strategy:**
• Use stored solar energy if available
• Switch to LA Department of Water and Power base period (8 PM - 10 AM)
• 30-40% cost savings vs. peak rates"""
    
    elif any(word in message for word in ['station', 'location', 'find', 'near']):
        return """**EV Charging Stations in LA**

**Quick Stats:**
• 3,520+ charging stations available
• 80% are public access
• 45% offer DC fast charging

**Popular Networks:**
• ChargePoint (largest network)
• EVgo (fast charging specialists)
• Electrify America (highway corridors)

**Finding Stations:**
• Use the Station Map tab above
• Filter by DC fast, public access, or network
• Get real-time availability and directions

**Pro Tip:** Plan routes with charging stops using our Route Planner!"""
    
    else:
        return """**EV Charging Assistant**

I can help you with:
• **Cost optimization** - Compare LA Department of Water and Power vs Southern California Edison rates
• **Solar integration** - Maximize renewable energy use
• **Station finding** - Locate nearby charging points
• **Route planning** - Optimal trips with charging stops
• **Charging tips** - Best practices and timing

**Quick Actions:**
• Ask: "Compare LA Department of Water and Power vs Southern California Edison costs"
• Ask: "When is the best time to charge?"
• Ask: "Find charging stations near me"

What would you like to know about EV charging in LA?"""

# Initialize API
ev_api = EVChargingAPI()

@app.route('/')
def index():
    """Serve React app"""
    return render_template('index.html')

@app.route('/api/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'models_loaded': len(ev_api.models),
        'stations_loaded': len(ev_api.la_stations)
    })

@app.route('/api/current-conditions')
def current_conditions():
    """Get current solar, weather, and pricing conditions"""
    try:
        # Get current data
        weather = ev_api.fetch_current_weather()
        solar = ev_api.calculate_solar_potential(weather)
        
        now = datetime.now()
        hour = now.hour
        is_weekend = now.weekday() >= 5
        
        los_angeles_dept_water_power_rate, los_angeles_dept_water_power_period = ev_api.get_tou_rates(hour, is_weekend, 'los_angeles_dept_water_power')
        southern_california_edison_rate, southern_california_edison_period = ev_api.get_tou_rates(hour, is_weekend, 'southern_california_edison')
        
        return jsonify({
            'status': 'success',
            'timestamp': now.isoformat(),
            'weather': weather,
            'solar': {
                'ghi': solar['ghi'],
                'power_kw': solar['power_kw'],
                'hourly_energy_kwh': solar['hourly_energy_kwh']
            },
            'pricing': {
                'los_angeles_dept_water_power': {'rate': los_angeles_dept_water_power_rate, 'period': los_angeles_dept_water_power_period},
                'southern_california_edison': {'rate': southern_california_edison_rate, 'period': southern_california_edison_period}
            }
        })
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/optimize-session', methods=['POST'])
def optimize_session():
    """Optimize EV charging session"""
    try:
        data = request.get_json()
        
        # Parse request
        session_start = datetime.fromisoformat(data['session_start'].replace('Z', '+00:00'))
        session_end = datetime.fromisoformat(data['session_end'].replace('Z', '+00:00'))
        energy_needed = float(data['energy_needed_kwh'])
        utility = data.get('utility', 'los_angeles_dept_water_power')
        
        # Validate inputs
        if session_end <= session_start:
            return jsonify({
                'status': 'error',
                'message': 'Session end must be after session start'
            }), 400
        
        if energy_needed <= 0:
            return jsonify({
                'status': 'error',
                'message': 'Energy needed must be positive'
            }), 400
        
        # Generate optimization schedule
        schedule = []
        current_time = session_start.replace(minute=0, second=0, microsecond=0)
        
        # Get weather for each hour
        while current_time < session_end:
            weather = ev_api.fetch_current_weather()  # In production, use forecast
            solar = ev_api.calculate_solar_potential(weather)
            
            hour = current_time.hour
            is_weekend = current_time.weekday() >= 5
            utility_rate, period = ev_api.get_tou_rates(hour, is_weekend, utility)
            
            # Get optimization score
            optimization_score = ev_api.predict_optimization_score(current_time, weather, utility)
            
            schedule.append({
                'datetime': current_time.isoformat(),
                'hour': hour,
                'optimization_score': optimization_score,
                'utility_rate': utility_rate,
                'solar_power_kw': solar['power_kw'],
                'temperature': weather['temperature']
            })
            
            current_time += timedelta(hours=1)
        
        # Sort by optimization score and allocate energy
        schedule_df = pd.DataFrame(schedule)
        schedule_df = schedule_df.sort_values('optimization_score', ascending=False)
        
        optimal_schedule = []
        remaining_energy = energy_needed
        
        for _, hour_data in schedule_df.iterrows():
            if remaining_energy <= 0:
                break
            
            hour_energy = min(remaining_energy, 50)  # 50 kW max
            hour_cost = hour_energy * hour_data['utility_rate']
            
            optimal_schedule.append({
                'datetime': hour_data['datetime'],
                'hour': int(hour_data['hour']),
                'energy_kwh': float(hour_energy),
                'charging_cost': float(hour_cost),
                'utility_rate': float(hour_data['utility_rate']),
                'optimization_score': float(hour_data['optimization_score']),
                'solar_available_kw': float(hour_data['solar_power_kw']),
                'solar_offset': float(min(hour_energy, hour_data['solar_power_kw']))
            })
            
            remaining_energy -= hour_energy
        
        # Calculate summary
        total_cost = sum(item['charging_cost'] for item in optimal_schedule)
        total_solar_offset = sum(item['solar_offset'] for item in optimal_schedule)
        
        return jsonify({
            'status': 'success',
            'timestamp': datetime.now().isoformat(),
            'optimization_summary': {
                'total_energy_kwh': float(energy_needed),
                'total_cost': float(total_cost),
                'average_rate': float(total_cost / energy_needed) if energy_needed > 0 else 0,
                'solar_offset_kwh': float(total_solar_offset),
                'solar_percentage': float((total_solar_offset / energy_needed) * 100) if energy_needed > 0 else 0,
                'charging_hours': len(optimal_schedule),
                'utility': utility
            },
            'charging_schedule': sorted(optimal_schedule, key=lambda x: x['datetime'])
        })
        
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'traceback': traceback.format_exc() if app.config['DEBUG'] else None,
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/stations')
def get_stations():
    """Get EV charging stations"""
    try:
        lat = request.args.get('lat', type=float)
        lon = request.args.get('lon', type=float)
        radius = request.args.get('radius', 5, type=float)
        limit = request.args.get('limit', 20, type=int)
        
        if lat is not None and lon is not None:
            # Calculate distances in miles
            def calc_distance(row):
                return np.sqrt((row['latitude'] - lat)**2 + (row['longitude'] - lon)**2) * 69  # 69 miles per degree
            
            stations = ev_api.la_stations.copy()
            stations['distance_miles'] = stations.apply(calc_distance, axis=1)
            nearby = stations[stations['distance_miles'] <= radius].sort_values('distance_miles').head(limit)
            
            stations_list = []
            for _, station in nearby.iterrows():
                stations_list.append({
                    'id': str(station.get('id', '')),
                    'name': str(station.get('station_name', 'Unknown')),
                    'latitude': float(station['latitude']),
                    'longitude': float(station['longitude']),
                    'distance_miles': float(station['distance_miles']),
                    'total_ports': int(station.get('total_charging_ports', 0)),
                    'has_dc_fast': bool(station.get('has_dc_fast', False)),
                    'is_public': bool(station.get('is_public', False)),
                    'network': str(station.get('ev_network', 'Unknown'))
                })
            
            return jsonify({
                'status': 'success',
                'stations': stations_list,
                'count': len(stations_list),
                'query': {'lat': lat, 'lon': lon, 'radius_miles': radius}
            })
        else:
            # Return summary statistics
            return jsonify({
                'status': 'success',
                'summary': ev_api.station_summary,
                'total_stations': len(ev_api.la_stations),
                'high_capacity_stations': len(ev_api.high_capacity_stations)
            })
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/claude-chat', methods=['POST'])
def claude_chat():
    """Claude AI conversational interface"""
    try:
        data = request.get_json()
        user_message = data.get('message', '')
        context = data.get('context', {})
        
        if not ev_api.api_keys['CLAUDE']:
            # Provide fallback response for common queries
            fallback_response = get_fallback_response(user_message.lower(), context)
            return jsonify({
                'status': 'success',
                'response': fallback_response,
                'timestamp': datetime.now().isoformat(),
                'note': 'Fallback response - Claude API not configured'
            })
        
        # Prepare context for Claude
        system_prompt = f"""You are an AI assistant for an EV charging optimization system in Los Angeles. 
        
Current conditions:
- {len(ev_api.la_stations)} EV charging stations available
- Real-time solar and weather integration
- LA Department of Water and Power and Southern California Edison utility rate optimization

Context: {json.dumps(context, indent=2)}

Help users with:
1. EV charging optimization questions
2. Solar energy integration 
3. Cost savings analysis
4. Charging station recommendations
5. Route planning with charging stops

Be helpful, accurate, and focus on EV charging optimization."""
        
        # Call Claude API
        headers = {
            'Content-Type': 'application/json',
            'x-api-key': ev_api.api_keys['CLAUDE'],
            'anthropic-version': '2023-06-01'
        }
        
        payload = {
            'model': 'claude-3-haiku-20240307',
            'max_tokens': 500,
            'system': system_prompt,
            'messages': [
                {'role': 'user', 'content': user_message}
            ]
        }
        
        response = requests.post(
            'https://api.anthropic.com/v1/messages',
            headers=headers,
            json=payload,
            timeout=30
        )
        
        if response.status_code == 200:
            claude_response = response.json()
            return jsonify({
                'status': 'success',
                'response': claude_response['content'][0]['text'],
                'timestamp': datetime.now().isoformat()
            })
        else:
            # Use fallback response on API error
            fallback_response = get_fallback_response(user_message.lower(), context)
            return jsonify({
                'status': 'success',
                'response': fallback_response,
                'timestamp': datetime.now().isoformat(),
                'note': f'Fallback response - Claude API error: {response.status_code}'
            })
            
    except Exception as e:
        # Use fallback response on any exception in Claude chat
        try:
            fallback_response = get_fallback_response(user_message.lower(), context)
            return jsonify({
                'status': 'success',
                'response': fallback_response,
                'timestamp': datetime.now().isoformat(),
                'note': f'Fallback response - Exception: {str(e)}'
            })
        except:
            return jsonify({
                'status': 'error',
                'message': 'Claude service temporarily unavailable',
                'timestamp': datetime.now().isoformat()
            }), 500

@app.route('/api/route-optimization', methods=['POST'])
def route_optimization():
    """Optimize route with charging stops using Google Maps"""
    try:
        data = request.get_json()
        start_location = data.get('start_location')  # {lat, lon} or address
        end_location = data.get('end_location')      # {lat, lon} or address
        vehicle_range_miles = data.get('vehicle_range_miles', 250)  # ~400km = 250 miles
        current_battery_percent = data.get('current_battery_percent', 80)
        
        if not ev_api.api_keys['GOOGLE_MAPS']:
            return jsonify({
                'status': 'error',
                'message': 'Google Maps API key not configured'
            }), 500
        
        # Use Google Maps Directions API
        maps_url = "https://maps.googleapis.com/maps/api/directions/json"
        params = {
            'origin': f"{start_location['lat']},{start_location['lon']}" if isinstance(start_location, dict) else start_location,
            'destination': f"{end_location['lat']},{end_location['lon']}" if isinstance(end_location, dict) else end_location,
            'key': ev_api.api_keys['GOOGLE_MAPS']
        }
        
        response = requests.get(maps_url, params=params, timeout=10)
        
        if response.status_code == 200:
            directions = response.json()
            
            if directions['status'] == 'OK':
                route = directions['routes'][0]
                total_distance_miles = route['legs'][0]['distance']['value'] * 0.000621371  # meters to miles
                
                # Calculate if charging stops are needed
                available_range = vehicle_range_miles * (current_battery_percent / 100)
                
                charging_stops = []
                if total_distance_miles > available_range * 0.8:  # 80% safety margin
                    # Find charging stations along route
                    # This is a simplified version - in production, use Google Places API
                    
                    # Get stations near midpoint as example
                    midpoint_lat = (start_location['lat'] + end_location['lat']) / 2
                    midpoint_lon = (start_location['lon'] + end_location['lon']) / 2
                    
                    def calc_distance(row):
                        return np.sqrt((row['latitude'] - midpoint_lat)**2 + (row['longitude'] - midpoint_lon)**2) * 69  # miles
                    
                    stations = ev_api.la_stations.copy()
                    stations['distance_miles'] = stations.apply(calc_distance, axis=1)
                    nearby = stations[stations['distance_miles'] <= 6].sort_values('distance_miles').head(3)  # 6 miles radius
                    
                    for _, station in nearby.iterrows():
                        charging_stops.append({
                            'name': str(station.get('station_name', 'Unknown')),
                            'latitude': float(station['latitude']),
                            'longitude': float(station['longitude']),
                            'distance_from_route': float(station['distance_miles']),
                            'has_dc_fast': bool(station.get('has_dc_fast', False)),
                            'network': str(station.get('ev_network', 'Unknown'))
                        })
                
                return jsonify({
                    'status': 'success',
                    'route': {
                        'distance_miles': total_distance_miles,
                        'duration_minutes': route['legs'][0]['duration']['value'] / 60,
                        'polyline': route['overview_polyline']['points']
                    },
                    'charging_analysis': {
                        'needs_charging': total_distance_miles > available_range * 0.8,
                        'available_range_miles': available_range,
                        'suggested_stops': charging_stops
                    },
                    'timestamp': datetime.now().isoformat()
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': f'Google Maps error: {directions["status"]}'
                }), 400
        else:
            return jsonify({
                'status': 'error',
                'message': f'Google Maps API error: {response.status_code}'
            }), 500
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e),
            'timestamp': datetime.now().isoformat()
        }), 500

@app.route('/api/directions', methods=['POST'])
def get_directions():
    """Get directions with traffic from Google Maps API"""
    try:
        data = request.json
        origin = data.get('origin')
        destination = data.get('destination')
        
        if not origin or not destination:
            return jsonify({'status': 'ERROR', 'error': 'Origin and destination required'}), 400
        
        if not ev_api.gmaps_client:
            return jsonify({'status': 'ERROR', 'error': 'Google Maps API not configured'}), 500
        
        # Get directions with traffic
        now = datetime.now()
        directions_result = ev_api.gmaps_client.directions(
            origin=origin,
            destination=destination,
            mode="driving",
            departure_time=now,
            traffic_model="best_guess"
        )
        
        if directions_result:
            route = directions_result[0]
            leg = route['legs'][0]
            
            response_data = {
                'status': 'OK',
                'distance': leg['distance']['text'],
                'distance_value': leg['distance']['value'],
                'duration': leg['duration']['text'],
                'duration_value': leg['duration']['value'],
                'start_address': leg['start_address'],
                'end_address': leg['end_address'],
                'polyline': route['overview_polyline']['points']
            }
            
            # Add traffic info if available
            if 'duration_in_traffic' in leg:
                response_data['duration_in_traffic'] = leg['duration_in_traffic']['text']
                response_data['duration_in_traffic_value'] = leg['duration_in_traffic']['value']
                traffic_delay = (leg['duration_in_traffic']['value'] - leg['duration']['value']) / 60
                response_data['traffic_delay_minutes'] = round(traffic_delay, 1)
            
            return jsonify(response_data)
        else:
            return jsonify({'status': 'ERROR', 'error': 'No route found'}), 404
            
    except Exception as e:
        return jsonify({'status': 'ERROR', 'error': str(e)}), 500

@app.route('/api/autocomplete', methods=['POST'])
def autocomplete_places():
    """Get place autocomplete suggestions for LA area"""
    try:
        data = request.json
        input_text = data.get('input', '')
        
        if not input_text or len(input_text) < 2:
            return jsonify({'status': 'OK', 'predictions': []})
            
        if not ev_api.gmaps_client:
            return jsonify({'status': 'ERROR', 'error': 'Google Maps API not configured'}), 500
        
        # Get autocomplete suggestions biased towards LA
        autocomplete_result = ev_api.gmaps_client.places_autocomplete(
            input_text=input_text,
            location=(34.0522, -118.2437),  # LA center
            radius=50000,  # 50km radius
            components={'country': 'us'}
        )
        
        suggestions = []
        for prediction in autocomplete_result:
            suggestions.append({
                'place_id': prediction['place_id'],
                'description': prediction['description'],
                'main_text': prediction['structured_formatting']['main_text'],
                'secondary_text': prediction['structured_formatting'].get('secondary_text', ''),
                'types': prediction['types']
            })
        
        return jsonify({
            'status': 'OK',
            'predictions': suggestions
        })
        
    except Exception as e:
        return jsonify({'status': 'ERROR', 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 8080)),
        debug=app.config['DEBUG']
    )
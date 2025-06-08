import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8080/api';

class ApiService {
  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        console.log(`🌐 API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ API Response: ${response.config.url} - ${response.status}`);
        return response;
      },
      (error) => {
        console.error('❌ Response Error:', error.response?.data || error.message);
        return Promise.reject(this.handleError(error));
      }
    );
  }

  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || `Server error: ${error.response.status}`;
      return new Error(message);
    } else if (error.request) {
      // Network error
      return new Error('Network error: Please check your connection and try again');
    } else {
      // Other error
      return new Error(error.message || 'An unexpected error occurred');
    }
  }

  // Health check
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Get current conditions (solar, weather, pricing)
  async getCurrentConditions() {
    try {
      const response = await this.client.get('/current-conditions');
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Optimize charging session
  async optimizeChargingSession(sessionData) {
    try {
      const response = await this.client.post('/optimize-session', sessionData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Get EV charging stations
  async getStations(params = {}) {
    try {
      const response = await this.client.get('/stations', { params });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Get nearby stations
  async getNearbyStations(lat, lon, radius = 5, limit = 20) {
    try {
      const response = await this.client.get('/stations', {
        params: { lat, lon, radius, limit }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Chat with Claude AI
  async chatWithClaude(message, context = {}) {
    try {
      const response = await this.client.post('/claude-chat', {
        message,
        context
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Route optimization with charging stops
  async optimizeRoute(routeData) {
    try {
      const response = await this.client.post('/route-optimization', routeData);
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Google Maps API endpoints
  async getDirections(origin, destination) {
    try {
      const response = await this.client.post('/directions', {
        origin,
        destination
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getPlaceAutocomplete(input) {
    try {
      const response = await this.client.post('/autocomplete', {
        input
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getNearbyPlaces(location, type = 'gas_station', radius = 2000) {
    try {
      const response = await this.client.post('/places', {
        location,
        type,
        radius
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  // Utility methods for data formatting
  formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatEnergy(kwh) {
    return `${kwh.toFixed(1)} kWh`;
  }

  formatPower(kw) {
    return `${kw.toFixed(1)} kW`;
  }

  formatDistance(km) {
    return `${km.toFixed(1)} km`;
  }

  formatTime(isoString) {
    return new Date(isoString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  formatDate(isoString) {
    return new Date(isoString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Get optimization recommendation text
  getOptimizationRecommendation(score) {
    if (score >= 0.8) {
      return { text: 'Excellent time to charge', color: '#4caf50', icon: '🌟' };
    } else if (score >= 0.6) {
      return { text: 'Good time to charge', color: '#8bc34a', icon: '👍' };
    } else if (score >= 0.4) {
      return { text: 'Moderate time to charge', color: '#ff9800', icon: '⚡' };
    } else if (score >= 0.2) {
      return { text: 'Poor time to charge', color: '#ff5722', icon: '⚠️' };
    } else {
      return { text: 'Avoid charging now', color: '#f44336', icon: '🚫' };
    }
  }

  // Get TOU period colors
  getTOUPeriodColor(period) {
    const colors = {
      'base_period': '#4caf50',
      'low_peak': '#ff9800',
      'high_peak': '#f44336',
      'off_peak': '#4caf50',
      'mid_peak': '#ff9800',
      'on_peak': '#f44336'
    };
    return colors[period] || '#666';
  }

  // Calculate savings percentage
  calculateSavings(optimizedCost, naiveCost) {
    if (naiveCost === 0) return 0;
    return ((naiveCost - optimizedCost) / naiveCost) * 100;
  }

  // Generate mock data for development/fallback
  generateMockCurrentConditions() {
    const now = new Date();
    return {
      status: 'success',
      timestamp: now.toISOString(),
      weather: {
        temperature: 22 + Math.random() * 8,
        description: 'partly cloudy',
        clouds: 30 + Math.random() * 40,
        wind_speed: 2 + Math.random() * 4
      },
      solar: {
        ghi: 400 + Math.random() * 600,
        power_kw: 20 + Math.random() * 40,
        hourly_energy_kwh: 20 + Math.random() * 40
      },
      pricing: {
        ladwp: {
          rate: 0.22 + Math.random() * 0.15,
          period: now.getHours() >= 13 && now.getHours() < 17 ? 'high_peak' : 'base_period'
        },
        sce: {
          rate: 0.27 + Math.random() * 0.05,
          period: now.getHours() >= 18 && now.getHours() < 20 ? 'on_peak' : 'off_peak'
        }
      }
    };
  }

  // Development helper - check if we're in development mode
  isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }
}

// Export a singleton instance
const apiServiceInstance = new ApiService();
export default apiServiceInstance;
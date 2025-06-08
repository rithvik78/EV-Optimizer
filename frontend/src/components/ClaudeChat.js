import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Avatar,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  Send as SendIcon,
  SmartToy as RobotIcon,
  Person as PersonIcon,
  Clear as ClearIcon,
  ElectricCar as CarIcon,
  WbSunny as SunIcon,
  AttachMoney as MoneyIcon
} from '@mui/icons-material';

import ApiService from '../services/ApiService';

const ClaudeChat = ({ currentConditions }) => {
  // AI Context and Learning State
  const [userContext, setUserContext] = useState({
    preferredChargingTime: null,
    vehicleType: null,
    typicalRoutes: [],
    chargingPattern: 'unknown',
    utilityProvider: null,
    conversationHistory: [],
    interests: []
  });
  
  const [aiInsights, setAiInsights] = useState({
    suggestedActions: [],
    proactiveRecommendations: [],
    learnedPreferences: {}
  });

  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'claude',
      content: `👋 Hi! I'm your AI assistant for EV charging optimization in Los Angeles. 

I can help you with:
• 🔋 Charging cost analysis and optimization
• ☀️ Solar energy integration strategies  
• 📍 Finding optimal charging stations
• 🗺️ Route planning with charging stops
• 💰 Comparing LA Department of Water and Power vs Southern California Edison rates
• 📊 Understanding your charging patterns

What would you like to know about EV charging optimization?`,
      timestamp: new Date(),
      suggestions: [
        'What\'s the best time to charge today?',
        'Compare LA Department of Water and Power vs Southern California Edison costs',
        'Find charging stations near me',
        'Plan a trip with charging stops'
      ]
    }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // AI-powered context learning from user messages
  const analyzeUserMessage = (message) => {
    const updates = {};
    
    // Extract vehicle mentions
    if (message.match(/tesla|model [sy3x]|nissan leaf|chevy bolt|rivian/i)) {
      const vehicleMatch = message.match(/(tesla|model [sy3x]|nissan leaf|chevy bolt|rivian)/i);
      if (vehicleMatch) updates.vehicleType = vehicleMatch[1];
    }
    
    // Extract time preferences
    if (message.match(/morning|night|evening|afternoon|[0-9]+[ap]m/i)) {
      const timeMatch = message.match(/(morning|night|evening|afternoon|[0-9]+[ap]m)/i);
      if (timeMatch) updates.preferredChargingTime = timeMatch[1];
    }
    
    // Extract utility preferences
    if (message.match(/los_angeles_dept_water_power|southern_california_edison|edison/i)) {
      const utilityMatch = message.match(/(los_angeles_dept_water_power|southern_california_edison|edison)/i);
      if (utilityMatch) updates.utilityProvider = utilityMatch[1].toUpperCase();
    }
    
    // Extract location patterns
    const locationPattern = /to\s+([a-zA-Z\s]+)|from\s+([a-zA-Z\s]+)|near\s+([a-zA-Z\s]+)/i;
    if (locationPattern.test(message)) {
      const locations = message.match(locationPattern);
      if (locations) updates.typicalRoutes = [...(userContext.typicalRoutes || []), locations[1] || locations[2] || locations[3]].slice(-5);
    }
    
    return updates;
  };

  // Generate AI-powered smart suggestions based on context
  const generateSmartSuggestions = (message, currentConditions) => {
    const suggestions = [];
    
    // Time-based suggestions
    const hour = new Date().getHours();
    if (hour >= 10 && hour <= 15) {
      suggestions.push("☀️ Use solar charging now - peak sun hours!");
    }
    
    // Cost-based suggestions
    if (currentConditions?.pricing?.ladwp?.rate < 0.25) {
      suggestions.push("💰 LA Department of Water and Power rates are low right now");
    }
    
    // Weather-based suggestions
    if (currentConditions?.weather?.temperature < 50) {
      suggestions.push("🌡️ Cold weather - plan for reduced range");
    }
    
    // Context-based suggestions
    if (userContext.vehicleType) {
      suggestions.push(`🔋 Optimize for your ${userContext.vehicleType}`);
    }
    
    return suggestions.slice(0, 3);
  };

  const handleSendMessage = async (message = inputMessage) => {
    if (!message.trim()) return;

    // AI Learning: Analyze and learn from user message
    const contextUpdates = analyzeUserMessage(message);
    setUserContext(prev => ({
      ...prev,
      ...contextUpdates,
      conversationHistory: [...prev.conversationHistory, message].slice(-10)
    }));

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Enhanced context with AI learning
      const enhancedContext = {
        current_conditions: currentConditions,
        user_context: userContext,
        conversation_history: messages.slice(-5),
        timestamp: new Date().toISOString(),
        location: 'Los Angeles, CA',
        available_utilities: ['LA Department of Water and Power', 'Southern California Edison'],
        ai_insights: aiInsights
      };

      const response = await ApiService.chatWithClaude(message, enhancedContext);

      // Generate smart suggestions
      const smartSuggestions = generateSmartSuggestions(message, currentConditions);

      const claudeMessage = {
        id: Date.now() + 1,
        sender: 'claude',
        content: response.response,
        timestamp: new Date(),
        suggestions: smartSuggestions
      };

      setMessages(prev => [...prev, claudeMessage]);
      
      // Update AI insights based on conversation
      setAiInsights(prev => ({
        ...prev,
        suggestedActions: smartSuggestions,
        learnedPreferences: { ...prev.learnedPreferences, ...contextUpdates }
      }));
      
    } catch (err) {
      setError(err.message);
      
      // Add error message
      const errorMessage = {
        id: Date.now() + 1,
        sender: 'claude',
        content: `I apologize, but I'm having trouble connecting right now. Here's what I can tell you based on your current conditions:

${generateOfflineResponse(message, currentConditions)}

Please try again in a moment for a more detailed response.`,
        timestamp: new Date(),
        isError: true
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const generateOfflineResponse = (message, conditions) => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('time') && lowerMessage.includes('charge')) {
      const currentRate = conditions?.pricing?.ladwp?.rate || 0.22;
      const period = conditions?.pricing?.ladwp?.period || 'base_period';
      
      if (period === 'high_peak') {
        return '⚠️ Current LA Department of Water and Power rate is at high peak ($0.37/kWh). Consider waiting until after 5 PM for lower rates.';
      } else if (period === 'base_period') {
        return '✅ Good time to charge! LA Department of Water and Power is currently at base period rates ($0.22/kWh).';
      } else {
        return `⚡ Current LA Department of Water and Power rate: $${currentRate.toFixed(3)}/kWh (${period.replace('_', ' ')})`;
      }
    }
    
    if (lowerMessage.includes('solar')) {
      const solarPower = conditions?.solar?.power_kw || 0;
      if (solarPower > 20) {
        return '☀️ Excellent solar generation right now! Great time to charge with renewable energy.';
      } else if (solarPower > 0) {
        return '🌤️ Moderate solar generation available. Some renewable energy offset possible.';
      } else {
        return '🌙 No solar generation currently (nighttime). Focus on low TOU rates.';
      }
    }
    
    if (lowerMessage.includes('cost') || lowerMessage.includes('save')) {
      return '💰 For cost optimization, charge during LA Department of Water and Power base periods (8 PM - 10 AM) or Southern California Edison off-peak hours. Avoid LA Department of Water and Power high peak (1-5 PM) and Southern California Edison on-peak (6-8 PM).';
    }
    
    return 'I can help with EV charging optimization, cost analysis, and station recommendations when my connection is restored.';
  };

  const handleSuggestionClick = (suggestion) => {
    handleSendMessage(suggestion);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearChat = () => {
    setMessages([messages[0]]); // Keep welcome message
    setError(null);
  };

  const getCurrentConditionsSummary = () => {
    if (!currentConditions) return null;

    const { weather, solar, pricing } = currentConditions;
    
    return (
      <Box mb={2}>
        <Typography variant="subtitle2" color="text.secondary" mb={1}>
          Current Conditions:
        </Typography>
        <Box display="flex" gap={1} flexWrap="wrap">
          <Chip
            icon={<SunIcon />}
            label={`${solar?.power_kw?.toFixed(1)} kW solar`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<MoneyIcon />}
            label={`LA Department of Water and Power $${pricing?.los_angeles_dept_water_power?.rate?.toFixed(3)}`}
            size="small"
            variant="outlined"
          />
          <Chip
            icon={<CarIcon />}
            label={`${weather?.temperature?.toFixed(1)}°F`}
            size="small"
            variant="outlined"
          />
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center">
            <Avatar sx={{ mr: 2, bgcolor: 'primary.main' }}>
              <RobotIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">
                AI Assistant
              </Typography>
              <Typography variant="body2" color="text.secondary">
                EV Charging Optimization Expert
              </Typography>
            </Box>
          </Box>
          <IconButton onClick={clearChat} title="Clear chat">
            <ClearIcon />
          </IconButton>
        </Box>
        
        {getCurrentConditionsSummary()}
        
        {error && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            Connection issue: {error}. Responses may be limited.
          </Alert>
        )}
      </Paper>

      {/* Messages */}
      <Paper sx={{ flexGrow: 1, p: 2, overflow: 'auto', mb: 2 }}>
        {messages.map((message) => (
          <Box key={message.id} mb={3}>
            <Box display="flex" alignItems="flex-start" gap={2}>
              <Avatar 
                sx={{ 
                  bgcolor: message.sender === 'claude' ? 'primary.main' : 'secondary.main',
                  mt: 0.5
                }}
              >
                {message.sender === 'claude' ? <RobotIcon /> : <PersonIcon />}
              </Avatar>
              
              <Box flexGrow={1}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <Typography variant="subtitle2" fontWeight="bold">
                    {message.sender === 'claude' ? 'AI Assistant' : 'You'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {message.timestamp.toLocaleTimeString()}
                  </Typography>
                </Box>
                
                <Typography 
                  variant="body1" 
                  sx={{ 
                    whiteSpace: 'pre-wrap',
                    color: message.isError ? 'warning.main' : 'inherit'
                  }}
                >
                  {message.content}
                </Typography>
                
                {/* Suggestions */}
                {message.suggestions && (
                  <Box mt={2}>
                    <Typography variant="caption" color="text.secondary" mb={1} display="block">
                      Quick suggestions:
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {message.suggestions.map((suggestion, index) => (
                        <Chip
                          key={index}
                          label={suggestion}
                          variant="outlined"
                          size="small"
                          clickable
                          onClick={() => handleSuggestionClick(suggestion)}
                          sx={{ 
                            '&:hover': { 
                              backgroundColor: 'primary.main',
                              color: 'white'
                            }
                          }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
            
            {message.id !== messages[messages.length - 1].id && (
              <Divider sx={{ mt: 2 }} />
            )}
          </Box>
        ))}
        
        {isLoading && (
          <Box display="flex" alignItems="center" gap={2} mb={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              <RobotIcon />
            </Avatar>
            <Box display="flex" alignItems="center" gap={1}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                AI Assistant is thinking...
              </Typography>
            </Box>
          </Box>
        )}
        
        <div ref={messagesEndRef} />
      </Paper>

      {/* Input */}
      <Paper sx={{ p: 2 }}>
        <Box display="flex" gap={2} alignItems="flex-end">
          <TextField
            fullWidth
            multiline
            maxRows={4}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask AI Assistant about EV charging optimization..."
            variant="outlined"
            disabled={isLoading}
            sx={{
              '& .MuiOutlinedInput-root': {
                backgroundColor: 'background.default',
              }
            }}
          />
          <Button
            variant="contained"
            onClick={() => handleSendMessage()}
            disabled={!inputMessage.trim() || isLoading}
            sx={{
              minWidth: 56,
              height: 56,
              background: 'linear-gradient(45deg, #667eea, #764ba2)',
              '&:hover': {
                background: 'linear-gradient(45deg, #5a67d8, #6b46c1)',
              }
            }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              <SendIcon />
            )}
          </Button>
        </Box>
        
        <Box mt={1}>
          <Typography variant="caption" color="text.secondary">
            💡 Tip: Ask about charging costs, optimal times, nearby stations, or route planning
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
};

export default ClaudeChat;
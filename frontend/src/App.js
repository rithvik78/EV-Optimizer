import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Box } from '@mui/material';

// Components
import Navbar from './components/Navbar';
import Dashboard from './components/Dashboard';
import ChargingOptimizer from './components/ChargingOptimizer';
import StationMap from './components/StationMap';
import RouteOptimizer from './components/RouteOptimizer';
import ClaudeChat from './components/ClaudeChat';
import LoadingScreen from './components/LoadingScreen';

// API Service
import ApiService from './services/ApiService';

// Theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#667eea',
      light: '#9bb5ff',
      dark: '#3f51b5',
    },
    secondary: {
      main: '#764ba2',
      light: '#a774d0',
      dark: '#512175',
    },
    background: {
      default: '#0a0e27',
      paper: '#1a1e3a',
    },
    text: {
      primary: '#ffffff',
      secondary: '#b0bec5',
    },
  },
  typography: {
    fontFamily: 'Inter, Arial, sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
    button: {
      textTransform: 'none',
      fontWeight: 500,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          padding: '10px 24px',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },
      },
    },
  },
});

function App() {
  const [currentConditions, setCurrentConditions] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    loadInitialData();
    
    // Set up periodic updates
    const interval = setInterval(loadCurrentConditions, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      await loadCurrentConditions();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentConditions = async () => {
    try {
      const conditions = await ApiService.getCurrentConditions();
      setCurrentConditions(conditions);
      setError(null);
    } catch (err) {
      console.error('Failed to load current conditions:', err);
      // Don't show error if we already have data
      if (!currentConditions) {
        setError(err.message);
      }
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (error && !currentConditions) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
          p={2}
        >
          <Box
            textAlign="center"
            bgcolor="background.paper"
            p={4}
            borderRadius={2}
            maxWidth={400}
          >
            <h2>Connection Error</h2>
            <p>{error}</p>
            <button 
              onClick={loadInitialData}
              style={{
                background: 'linear-gradient(45deg, #667eea, #764ba2)',
                color: 'white',
                border: 'none',
                padding: '12px 24px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Retry Connection
            </button>
          </Box>
        </Box>
      </ThemeProvider>
    );
  }

  // Floating Chat Button Component (inside Router context)
  const FloatingChatButton = () => {
    const navigate = useNavigate();
    
    const handleChatClick = () => {
      setActiveTab('chat');
      navigate('/chat');
    };

    return (
      <Box
        position="fixed"
        bottom={20}
        right={20}
        zIndex={1000}
      >
        <button
          onClick={handleChatClick}
          style={{
            background: 'linear-gradient(45deg, #667eea, #764ba2)',
            color: 'white',
            border: 'none',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            fontSize: '24px',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            transition: 'transform 0.2s ease',
          }}
          onMouseEnter={(e) => e.target.style.transform = 'scale(1.1)'}
          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
          title="Ask AI Assistant"
        >
          AI
        </button>
      </Box>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
          <Navbar 
            activeTab={activeTab} 
            setActiveTab={setActiveTab}
            currentConditions={currentConditions}
          />
          
          <Box component="main" sx={{ flexGrow: 1, p: 3 }}>
            <Routes>
              <Route 
                path="/dashboard" 
                element={
                  <Dashboard 
                    currentConditions={currentConditions}
                    onRefresh={loadCurrentConditions}
                  />
                } 
              />
              <Route 
                path="/optimizer" 
                element={
                  <ChargingOptimizer 
                    currentConditions={currentConditions}
                  />
                } 
              />
              <Route 
                path="/map" 
                element={
                  <StationMap 
                    currentConditions={currentConditions}
                  />
                } 
              />
              <Route 
                path="/route" 
                element={
                  <RouteOptimizer 
                    currentConditions={currentConditions}
                  />
                } 
              />
              <Route 
                path="/chat" 
                element={
                  <ClaudeChat 
                    currentConditions={currentConditions}
                  />
                } 
              />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Box>
          
          {/* Floating Chat Button */}
          <FloatingChatButton />
        </Box>
      </Router>
    </ThemeProvider>
  );
}

export default App;
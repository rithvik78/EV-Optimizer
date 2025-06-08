import React from 'react';
import { Box, Typography, CircularProgress, LinearProgress } from '@mui/material';

const LoadingScreen = () => {
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const timer = setInterval(() => {
      setProgress((oldProgress) => {
        if (oldProgress === 100) {
          return 0;
        }
        const diff = Math.random() * 10;
        return Math.min(oldProgress + diff, 100);
      });
    }, 500);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <Box
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      minHeight="100vh"
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}
    >
      <Box textAlign="center" maxWidth={400} p={4}>
        {/* Logo */}
        <Typography 
          variant="h3" 
          component="h1" 
          fontWeight="bold" 
          mb={2}
          sx={{
            background: 'linear-gradient(45deg, #ffffff, #e3f2fd)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          ⚡ EV Optimizer
        </Typography>
        
        <Typography variant="h6" mb={4} sx={{ opacity: 0.9 }}>
          Los Angeles Charging Intelligence
        </Typography>

        {/* Loading Animation */}
        <Box position="relative" display="inline-flex" mb={3}>
          <CircularProgress
            size={60}
            thickness={4}
            sx={{
              color: 'rgba(255,255,255,0.3)',
            }}
          />
          <CircularProgress
            size={60}
            thickness={4}
            variant="determinate"
            value={progress}
            sx={{
              color: 'white',
              position: 'absolute',
              left: 0,
            }}
          />
        </Box>

        <Typography variant="body1" mb={2}>
          🔌 Loading EV charging data...
        </Typography>

        <Box width="100%" mb={3}>
          <LinearProgress 
            variant="determinate" 
            value={progress}
            sx={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              '& .MuiLinearProgress-bar': {
                backgroundColor: 'white'
              }
            }}
          />
        </Box>

        <Typography variant="body2" sx={{ opacity: 0.8 }}>
          {progress < 30 && "🌐 Connecting to APIs..."}
          {progress >= 30 && progress < 60 && "☀️ Loading solar data..."}
          {progress >= 60 && progress < 90 && "🔋 Initializing ML models..."}
          {progress >= 90 && "✅ Almost ready!"}
        </Typography>

        <Box mt={4}>
          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Powered by AI • Real-time optimization • 3,520+ LA stations
          </Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default LoadingScreen;
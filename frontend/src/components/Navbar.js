import React from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  Chip,
  IconButton,
  useTheme,
  useMediaQuery,
  Menu,
  MenuItem
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  ElectricCar as CarIcon,
  Map as MapIcon,
  Route as RouteIcon,
  Chat as ChatIcon,
  Menu as MenuIcon
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

// import ApiService from '../services/ApiService';

const Navbar = ({ activeTab, setActiveTab, currentConditions }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  const [mobileMenuAnchor, setMobileMenuAnchor] = React.useState(null);

  const navigationItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
    { id: 'optimizer', label: 'Optimizer', icon: <CarIcon />, path: '/optimizer' },
    { id: 'map', label: 'Station Map', icon: <MapIcon />, path: '/map' },
    { id: 'route', label: 'Route Planner', icon: <RouteIcon />, path: '/route' },
    { id: 'chat', label: 'AI Assistant', icon: <ChatIcon />, path: '/chat' }
  ];

  const handleNavigation = (item) => {
    setActiveTab(item.id);
    navigate(item.path);
    setMobileMenuAnchor(null);
  };

  const getCurrentStatus = () => {
    if (!currentConditions) return { text: 'Loading...', color: 'warning' };
    
    const solarPower = currentConditions.solar?.power_kw || 0;
    const los_angeles_dept_water_power_period = currentConditions.pricing?.los_angeles_dept_water_power?.period || '';
    
    if (solarPower > 30 && los_angeles_dept_water_power_period === 'base_period') {
      return { text: 'Optimal Charging', color: 'success' };
    } else if (los_angeles_dept_water_power_period === 'high_peak') {
      return { text: 'High Peak - Avoid', color: 'error' };
    } else if (solarPower > 20) {
      return { text: 'Good Solar', color: 'success' };
    } else {
      return { text: 'Moderate Conditions', color: 'warning' };
    }
  };

  const currentPath = location.pathname;
  const status = getCurrentStatus();

  return (
    <AppBar 
      position="sticky" 
      sx={{ 
        background: 'linear-gradient(90deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
      }}
    >
      <Toolbar>
        {/* Logo and Title */}
        <Box display="flex" alignItems="center" mr={4}>
          <Typography 
            variant="h6" 
            component="div" 
            fontWeight="bold"
            sx={{ 
              background: 'linear-gradient(45deg, #ffffff, #e3f2fd)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              fontSize: { xs: '1.1rem', md: '1.25rem' }
            }}
          >
            ⚡ EV Optimizer
          </Typography>
        </Box>

        {/* Desktop Navigation */}
        {!isMobile && (
          <Box display="flex" gap={1} flexGrow={1}>
            {navigationItems.map((item) => (
              <Button
                key={item.id}
                startIcon={item.icon}
                onClick={() => handleNavigation(item)}
                sx={{
                  color: 'white',
                  textTransform: 'none',
                  px: 2,
                  py: 1,
                  borderRadius: 2,
                  backgroundColor: currentPath === item.path ? 'rgba(255,255,255,0.2)' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.15)',
                  },
                  transition: 'all 0.2s ease'
                }}
              >
                {item.label}
              </Button>
            ))}
          </Box>
        )}

        {/* Mobile Menu Button */}
        {isMobile && (
          <Box flexGrow={1} display="flex" justifyContent="flex-end">
            <IconButton
              color="inherit"
              onClick={(e) => setMobileMenuAnchor(e.currentTarget)}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={mobileMenuAnchor}
              open={Boolean(mobileMenuAnchor)}
              onClose={() => setMobileMenuAnchor(null)}
              PaperProps={{
                sx: {
                  bgcolor: 'background.paper',
                  mt: 1
                }
              }}
            >
              {navigationItems.map((item) => (
                <MenuItem
                  key={item.id}
                  onClick={() => handleNavigation(item)}
                  selected={currentPath === item.path}
                >
                  <Box display="flex" alignItems="center">
                    {item.icon}
                    <Typography ml={2}>{item.label}</Typography>
                  </Box>
                </MenuItem>
              ))}
            </Menu>
          </Box>
        )}

        {/* Status and Conditions */}
        {!isMobile && currentConditions && (
          <Box display="flex" gap={1} ml={2}>
            <Chip
              label={status.text}
              color={status.color}
              size="small"
              sx={{ 
                backgroundColor: `${status.color}.main`,
                color: 'white',
                fontWeight: 500
              }}
            />
            
            <Chip
              label={`☀️ ${currentConditions.solar?.power_kw?.toFixed(1)} kW`}
              size="small"
              variant="outlined"
              sx={{ 
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
                '& .MuiChip-label': { color: 'white' }
              }}
            />
            
            <Chip
              label={`💰 $${currentConditions.pricing?.ladwp?.rate?.toFixed(3)}`}
              size="small"
              variant="outlined"
              sx={{ 
                color: 'white',
                borderColor: 'rgba(255,255,255,0.3)',
                '& .MuiChip-label': { color: 'white' }
              }}
            />
          </Box>
        )}

        {/* Mobile Status */}
        {isMobile && currentConditions && (
          <Box ml={2}>
            <Chip
              label={status.text}
              color={status.color}
              size="small"
              sx={{ 
                backgroundColor: `${status.color}.main`,
                color: 'white',
                fontSize: '0.75rem'
              }}
            />
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
};

export default Navbar;
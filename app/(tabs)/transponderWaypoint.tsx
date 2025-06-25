import * as Location from 'expo-location';
import { Magnetometer } from 'expo-sensors';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

const GPSDirectionalArrow = () => {
  // Target location - you can change this to any lat/lng you want to point to
  const targetLocation = {
    latitude: 37.7749,  // San Francisco
    longitude: -122.4194
  };

  const [currentLocation, setCurrentLocation] = useState(null);
  const [compassHeading, setCompassHeading] = useState(0);
  const [bearing, setBearing] = useState(0);
  const [distance, setDistance] = useState(0);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accuracy, setAccuracy] = useState(0);
  
  const arrowRotation = useRef(new Animated.Value(0)).current;
  const locationSubscription = useRef(null);
  const headingSubscription = useRef(null);
  const magnetometerSubscription = useRef(null);

  // Calculate bearing and distance using Haversine formula
  const calculateNavigationData = (fromLocation, toLocation) => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = fromLocation.latitude * Math.PI/180;
    const φ2 = toLocation.latitude * Math.PI/180;
    const Δφ = (toLocation.latitude - fromLocation.latitude) * Math.PI/180;
    const Δλ = (toLocation.longitude - fromLocation.longitude) * Math.PI/180;

    // Distance calculation (Haversine formula)
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const calculatedDistance = R * c;

    // Initial bearing calculation (forward azimuth)
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - 
              Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    const θ = Math.atan2(y, x);
    const calculatedBearing = (θ * 180/Math.PI + 360) % 360;

    return { distance: calculatedDistance, bearing: calculatedBearing };
  };

  const requestPermissions = async () => {
    try {
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings.',
          [{ text: 'OK' }]
        );
        throw new Error('Location services are disabled');
      }

      // Request location permissions
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission Denied',
          'Location permission is required for navigation.',
          [{ text: 'OK' }]
        );
        throw new Error('Location permission denied');
      }

      // Request sensor permissions (optional - will fallback if not available)
      try {
        await Magnetometer.requestPermissionsAsync();
      } catch (sensorError) {
        console.warn('Magnetometer permission not available, using GPS heading');
      }

      return true;
    } catch (error) {
      setError(error.message);
      setLoading(false);
      return false;
    }
  };

  const startLocationTracking = async () => {
    try {
      // Start location updates with balanced accuracy for battery optimization
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000,    // Update every 2 seconds
          distanceInterval: 5,   // Update when moved 5+ meters
        },
        (location) => {
          setCurrentLocation(location.coords);
          setAccuracy(location.coords.accuracy || 0);
          
          // Calculate bearing and distance to target
          const { distance: newDistance, bearing: newBearing } = 
            calculateNavigationData(location.coords, targetLocation);
          setDistance(newDistance);
          setBearing(newBearing);
          
          setLoading(false);
        }
      );

      // Try to get compass heading from Location API (more accurate)
      try {
        headingSubscription.current = await Location.watchHeadingAsync((heading) => {
          // Prefer true heading over magnetic heading
          const headingValue = heading.trueHeading !== -1 ? heading.trueHeading : heading.magHeading;
          setCompassHeading(headingValue);
        });
      } catch (headingError) {
        console.warn('Location heading not available, using magnetometer');
        startMagnetometerFallback();
      }

    } catch (error) {
      console.error('Location tracking error:', error);
      setError('Failed to start location tracking: ' + error.message);
      setLoading(false);
    }
  };

  const startMagnetometerFallback = async () => {
    try {
      const isAvailable = await Magnetometer.isAvailableAsync();
      if (isAvailable) {
        Magnetometer.setUpdateInterval(200); // 5Hz updates for battery optimization
        
        magnetometerSubscription.current = Magnetometer.addListener(({ x, y }) => {
          // Calculate magnetic heading from magnetometer data
          let magneticHeading = Math.atan2(-x, y) * (180 / Math.PI);
          if (magneticHeading < 0) {
            magneticHeading += 360;
          }
          
          setCompassHeading(magneticHeading);
        });
      }
    } catch (error) {
      console.warn('Magnetometer fallback failed:', error);
    }
  };

  useEffect(() => {
    const initialize = async () => {
      const hasPermissions = await requestPermissions();
      if (hasPermissions) {
        await startLocationTracking();
      }
    };

    initialize();

    // Cleanup subscriptions on unmount
    return () => {
      locationSubscription.current?.remove();
      headingSubscription.current?.remove();
      magnetometerSubscription.current?.remove();
    };
  }, []);

  // Animate arrow rotation when bearing or compass heading changes
  useEffect(() => {
    if (currentLocation && !loading) {
      // Calculate arrow direction: target bearing minus current compass heading
      let arrowDirection = bearing - compassHeading;
      
      // Handle 360° wraparound for smooth animation
      if (arrowDirection > 180) {
        arrowDirection -= 360;
      } else if (arrowDirection < -180) {
        arrowDirection += 360;
      }

      Animated.timing(arrowRotation, {
        toValue: arrowDirection,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [bearing, compassHeading, currentLocation, loading]);

  const formatDistance = (dist) => {
    if (dist < 1000) return `${Math.round(dist)}m`;
    if (dist < 10000) return `${(dist / 1000).toFixed(1)}km`;
    return `${Math.round(dist / 1000)}km`;
  };

  const formatCoordinate = (coord, isLongitude = false) => {
    const direction = isLongitude ? (coord >= 0 ? 'E' : 'W') : (coord >= 0 ? 'N' : 'S');
    return `${Math.abs(coord).toFixed(4)}°${direction}`;
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>🛰️ Getting your location...</Text>
          <Text style={styles.loadingSubtext}>This may take a few moments</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>⚠️ Location Error</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>Check your location settings and try again</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>TREASURE SEEKER</Text>
        <Text style={styles.subtitle}>Navigate to Target</Text>
      </View>

      {/* Main compass circle with arrow */}
      <View style={styles.compassContainer}>
        <View style={styles.compassCircle}>
          {/* Animated arrow in center */}
          <Animated.View
            style={[
              styles.arrowContainer,
              {
                transform: [
                  {
                    rotate: arrowRotation.interpolate({
                      inputRange: [-180, 180],
                      outputRange: ['-180deg', '180deg'],
                    }),
                  },
                ],
              },
            ]}
          >
            <Svg width={60} height={60} viewBox="0 0 60 60">
              <Path
                d="M30 5 L40 45 L30 40 L20 45 Z"
                fill="#FF3B30"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </Svg>
          </Animated.View>
          
          {/* Distance display in center */}
          <View style={styles.distanceContainer}>
            <Text style={styles.distanceText}>{formatDistance(distance)}</Text>
          </View>
        </View>

        {/* Cardinal direction markers */}
        <Text style={[styles.cardinalText, styles.northText]}>N</Text>
        <Text style={[styles.cardinalText, styles.eastText]}>E</Text>
        <Text style={[styles.cardinalText, styles.southText]}>S</Text>
        <Text style={[styles.cardinalText, styles.westText]}>W</Text>
      </View>

      {/* Data display */}
      <View style={styles.dataContainer}>
        <Text style={styles.dataTitle}>NAVIGATION DATA</Text>
        
        <View style={styles.dataGrid}>
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>BEARING</Text>
            <Text style={styles.dataValue}>{Math.round(bearing)}°</Text>
          </View>
          
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>HEADING</Text>
            <Text style={styles.dataValue}>{Math.round(compassHeading)}°</Text>
          </View>
          
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>ACCURACY</Text>
            <Text style={styles.dataValue}>±{Math.round(accuracy)}m</Text>
          </View>
          
          <View style={styles.dataItem}>
            <Text style={styles.dataLabel}>DISTANCE</Text>
            <Text style={styles.dataValue}>{formatDistance(distance)}</Text>
          </View>
        </View>

        {/* Current coordinates */}
        <View style={styles.coordsContainer}>
          <Text style={styles.coordsTitle}>CURRENT POSITION</Text>
          <Text style={styles.coordsText}>
            {formatCoordinate(currentLocation?.latitude || 0)} {formatCoordinate(currentLocation?.longitude || 0, true)}
          </Text>
        </View>

        {/* Target coordinates */}
        <View style={styles.coordsContainer}>
          <Text style={styles.coordsTitle}>TARGET POSITION</Text>
          <Text style={styles.coordsText}>
            {formatCoordinate(targetLocation.latitude)} {formatCoordinate(targetLocation.longitude, true)}
          </Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#00ff00',
    fontSize: 18,
    marginBottom: 10,
  },
  loadingSubtext: {
    color: '#00ff00',
    fontSize: 14,
    opacity: 0.7,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  errorTitle: {
    color: '#ff0000',
    fontSize: 20,
    marginBottom: 15,
    textAlign: 'center',
  },
  errorText: {
    color: '#ff0000',
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
  },
  errorHint: {
    color: '#ffaa00',
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#00ff00',
    letterSpacing: 3,
  },
  subtitle: {
    fontSize: 12,
    color: '#00ff00',
    opacity: 0.7,
    marginTop: 5,
  },
  compassContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 40,
    position: 'relative',
  },
  compassCircle: {
    width: Math.min(width * 0.7, 280),
    height: Math.min(width * 0.7, 280),
    borderRadius: Math.min(width * 0.35, 140),
    borderWidth: 3,
    borderColor: '#00ff00',
    backgroundColor: 'rgba(0, 255, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  arrowContainer: {
    position: 'absolute',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  distanceContainer: {
    position: 'absolute',
    bottom: 30,
    alignItems: 'center',
  },
  distanceText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardinalText: {
    position: 'absolute',
    color: '#00ff00',
    fontSize: 18,
    fontWeight: 'bold',
  },
  northText: {
    top: -30,
  },
  eastText: {
    right: -30,
    top: '45%',
  },
  southText: {
    bottom: -30,
  },
  westText: {
    left: -30,
    top: '45%',
  },
  dataContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderRadius: 15,
    padding: 20,
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  dataTitle: {
    color: '#00ff00',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
  },
  dataGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  dataItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
  },
  dataLabel: {
    color: '#00ff00',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 5,
  },
  dataValue: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },
  coordsContainer: {
    marginBottom: 15,
  },
  coordsTitle: {
    color: '#00ff00',
    fontSize: 12,
    marginBottom: 5,
    textAlign: 'center',
  },
  coordsText: {
    color: '#ffffff',
    fontSize: 14,
    fontFamily: 'monospace',
    textAlign: 'center',
  },
});

export default GPSDirectionalArrow;
import { Accelerometer, Magnetometer } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Text as SvgText } from 'react-native-svg';

const { width, height } = Dimensions.get('window');

export default function TransponderCompass() {
  const [magnetometerData, setMagnetometerData] = useState({ x: 0, y: 0, z: 0 });
  const [accelerometerData, setAccelerometerData] = useState({ x: 0, y: 0, z: 0 });
  const [heading, setHeading] = useState(0);
  const [isCalibrated, setIsCalibrated] = useState(false);

  useEffect(() => {
    // Start magnetometer
    Magnetometer.setUpdateInterval(100);
    const magnetometerSubscription = Magnetometer.addListener((data) => {
      setMagnetometerData(data);
      
      // Calculate magnetic heading
      // In device coordinates: +X is right, +Y is up, +Z is out of screen
      // For compass: 0° = North, 90° = East, 180° = South, 270° = West
      let angle = Math.atan2(-data.x, data.y) * (180 / Math.PI);
      
      // Normalize to 0-360 degrees
      if (angle < 0) {
        angle += 360;
      }
      
      setHeading(angle);
    });

    // Start accelerometer
    Accelerometer.setUpdateInterval(100);
    const accelerometerSubscription = Accelerometer.addListener((data) => {
      setAccelerometerData(data);
    });

    // Check if sensors are available
    Magnetometer.isAvailableAsync().then((available) => {
      setIsCalibrated(available);
    });

    return () => {
      magnetometerSubscription.remove();
      accelerometerSubscription.remove();
    };
  }, []);

  const compassSize = Math.min(width, height) * 0.6;
  const compassRadius = compassSize / 2;
  const centerX = compassSize / 2;
  const centerY = compassSize / 2;

  // Calculate device orientation
  const pitch = Math.atan2(accelerometerData.y, accelerometerData.z) * (180 / Math.PI);
  const roll = Math.atan2(accelerometerData.x, accelerometerData.z) * (180 / Math.PI);

  // Apply tilt compensation to magnetometer readings
  const cosRoll = Math.cos(roll * Math.PI / 180);
  const sinRoll = Math.sin(roll * Math.PI / 180);
  const cosPitch = Math.cos(pitch * Math.PI / 180);
  const sinPitch = Math.sin(pitch * Math.PI / 180);

  // Tilt-compensated magnetometer values
  const magX = magnetometerData.x * cosPitch + magnetometerData.z * sinPitch;
  const magY = magnetometerData.x * sinRoll * sinPitch + magnetometerData.y * cosRoll - magnetometerData.z * sinRoll * cosPitch;

  // Calculate tilt-compensated heading
  let compensatedHeading = Math.atan2(-magX, magY) * (180 / Math.PI);
  if (compensatedHeading < 0) {
    compensatedHeading += 360;
  }

  // The compass rose should rotate to keep North pointing up
  const compassRotation = -compensatedHeading;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>TRANSPONDER</Text>
        <Text style={styles.subtitle}>Seeking Target</Text>
      </View>

      {/* Main Compass */}
      <View style={styles.compassContainer}>
        <Svg width={compassSize} height={compassSize} style={styles.compass}>
          {/* Outer circle */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={compassRadius - 10}
            fill="none"
            stroke="#00ff00"
            strokeWidth="2"
          />
          
          {/* Inner circle */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={compassRadius - 40}
            fill="none"
            stroke="#00ff00"
            strokeWidth="1"
            opacity="0.5"
          />

          {/* Cardinal directions */}
          <G rotation={compassRotation} origin={`${centerX}, ${centerY}`}>
            {/* North marker */}
            <Line
              x1={centerX}
              y1={20}
              x2={centerX}
              y2={40}
              stroke="#ff0000"
              strokeWidth="3"
            />
            <SvgText
              x={centerX}
              y={15}
              fontSize="16"
              fill="#ff0000"
              textAnchor="middle"
              fontWeight="bold"
            >
              N
            </SvgText>

            {/* East marker */}
            <Line
              x1={compassSize - 20}
              y1={centerY}
              x2={compassSize - 40}
              y2={centerY}
              stroke="#00ff00"
              strokeWidth="2"
            />
            <SvgText
              x={compassSize - 15}
              y={centerY + 5}
              fontSize="14"
              fill="#00ff00"
              textAnchor="middle"
            >
              E
            </SvgText>

            {/* South marker */}
            <Line
              x1={centerX}
              y1={compassSize - 20}
              x2={centerX}
              y2={compassSize - 40}
              stroke="#00ff00"
              strokeWidth="2"
            />
            <SvgText
              x={centerX}
              y={compassSize - 10}
              fontSize="14"
              fill="#00ff00"
              textAnchor="middle"
            >
              S
            </SvgText>

            {/* West marker */}
            <Line
              x1={20}
              y1={centerY}
              x2={40}
              y2={centerY}
              stroke="#00ff00"
              strokeWidth="2"
            />
            <SvgText
              x={15}
              y={centerY + 5}
              fontSize="14"
              fill="#00ff00"
              textAnchor="middle"
            >
              W
            </SvgText>

            {/* Degree markers */}
            {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((degree) => (
              <G key={degree} rotation={degree} origin={`${centerX}, ${centerY}`}>
                <Line
                  x1={centerX}
                  y1={25}
                  x2={centerX}
                  y2={35}
                  stroke="#00ff00"
                  strokeWidth="1"
                  opacity="0.7"
                />
              </G>
            ))}
          </G>

          {/* Direction needle (pointing to target) */}
          <Line
            x1={centerX}
            y1={centerY}
            x2={centerX}
            y2={centerY - compassRadius + 60}
            stroke="#ffff00"
            strokeWidth="3"
            strokeLinecap="round"
          />
          
          {/* Center dot */}
          <Circle
            cx={centerX}
            cy={centerY}
            r="4"
            fill="#ffff00"
          />
        </Svg>
      </View>

      {/* Status indicator */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {isCalibrated ? 'CALIBRATED' : 'CALIBRATING...'}
        </Text>
        <View style={[styles.statusDot, { backgroundColor: isCalibrated ? '#00ff00' : '#ff0000' }]} />
      </View>

      {/* Sensor readings */}
      <View style={styles.dataContainer}>
        <Text style={styles.dataTitle}>SENSOR READINGS</Text>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>HEADING:</Text>
          <Text style={styles.dataValue}>{Math.round(compensatedHeading)}°</Text>
        </View>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>RAW HDG:</Text>
          <Text style={styles.dataValue}>{Math.round(heading)}°</Text>
        </View>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>COMPASS:</Text>
          <Text style={styles.dataValue}>
            X: {magnetometerData.x.toFixed(2)} Y: {magnetometerData.y.toFixed(2)} Z: {magnetometerData.z.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>ACCEL:</Text>
          <Text style={styles.dataValue}>
            X: {accelerometerData.x.toFixed(2)} Y: {accelerometerData.y.toFixed(2)} Z: {accelerometerData.z.toFixed(2)}
          </Text>
        </View>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>TILT:</Text>
          <Text style={styles.dataValue}>P: {Math.round(pitch)}° R: {Math.round(roll)}°</Text>
        </View>
        
        <View style={styles.dataRow}>
          <Text style={styles.dataLabel}>MAG COMP:</Text>
          <Text style={styles.dataValue}>X: {magX.toFixed(2)} Y: {magY.toFixed(2)}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  compass: {
    backgroundColor: 'rgba(0, 255, 0, 0.05)',
    borderRadius: 1000,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  statusText: {
    color: '#00ff00',
    fontSize: 12,
    marginRight: 10,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dataContainer: {
    width: '90%',
    backgroundColor: 'rgba(0, 255, 0, 0.1)',
    borderRadius: 10,
    padding: 15,
    borderWidth: 1,
    borderColor: '#00ff00',
  },
  dataTitle: {
    color: '#00ff00',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 3,
  },
  dataLabel: {
    color: '#00ff00',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  dataValue: {
    color: '#ffffff',
    fontSize: 12,
    fontFamily: 'monospace',
  },
});
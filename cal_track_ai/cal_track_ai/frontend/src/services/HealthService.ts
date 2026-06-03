import { Platform } from 'react-native';
import AppleHealthKit, { HealthValue, HealthKitPermissions } from 'react-native-health';
import { initialize, requestPermission, readRecords } from 'react-native-health-connect';

export const connectHealth = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      // Avoid calling AppleHealthKit methods immediately during import or early render.
      if (!AppleHealthKit || !AppleHealthKit.initHealthKit) {
        console.log('[ERROR] AppleHealthKit is not available (Native module missing).');
        return resolve(false);
      }
      
      const permissions: HealthKitPermissions = {
        permissions: {
          read: [AppleHealthKit.Constants?.Permissions?.StepCount || 'StepCount'],
          write: [],
        },
      };
      
      AppleHealthKit.initHealthKit(permissions, (error) => {
        if (error) {
          console.log('[ERROR] Cannot grant Apple Health permissions!', error);
          resolve(false);
        } else {
          resolve(true);
        }
      });
    });
  } else if (Platform.OS === 'android') {
    try {
      await initialize();
      await requestPermission([
        { accessType: 'read', recordType: 'Steps' }
      ]);
      return true;
    } catch (error) {
      console.error('[ERROR] Cannot grant Health Connect permissions!', error);
      return false;
    }
  }
  return false;
};

export const getTodaySteps = async (): Promise<number> => {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  
  if (Platform.OS === 'ios') {
    return new Promise((resolve) => {
      if (!AppleHealthKit || !AppleHealthKit.getStepCount) {
        console.log('[ERROR] AppleHealthKit is not available.');
        return resolve(0);
      }
      const options: any = {
        date: startOfDay.toISOString(),
      };
      AppleHealthKit.getStepCount(options, (err: string, results: HealthValue) => {
        if (err || !results) {
          console.log('[ERROR] Cannot get steps:', err);
          resolve(0);
        } else {
          resolve(results.value);
        }
      });
    });
  } else if (Platform.OS === 'android') {
    try {
      const today = new Date();
      const response = await readRecords('Steps', {
        timeRangeFilter: {
          operator: 'between',
          startTime: startOfDay.toISOString(),
          endTime: today.toISOString(),
        }
      });
      const totalSteps = response.records.reduce((sum: number, record: any) => sum + (record.count || 0), 0);
      return totalSteps;
    } catch (error) {
      console.error('[ERROR] Cannot get Android steps:', error);
      return 0;
    }
  }
  return 0;
};

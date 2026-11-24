import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WorkoutProvider } from '../state/workout';

export default function Layout() {
  return <SafeAreaProvider><WorkoutProvider><StatusBar style="dark" />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F6F2' } }} />
  </WorkoutProvider></SafeAreaProvider>;
}

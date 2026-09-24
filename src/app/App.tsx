import UnlockScreen from '../screens/Auth/UnlockScreen';
import { useAuthStore } from '../stores/authStore';
import AppShell from './AppShell';

export default function App() {
  const isUnlocked = useAuthStore((s) => s.isUnlocked);
  return isUnlocked ? <AppShell /> : <UnlockScreen />;
}

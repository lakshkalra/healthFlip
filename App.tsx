import { StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <View style={styles.container}>
        <Text style={styles.title}>healthFlip</Text>
        <Text style={styles.subtitle}>Personal health assistant</Text>
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7F8F4',
    padding: 24,
  },
  title: {
    color: '#173B35',
    fontSize: 36,
    fontWeight: '700',
  },
  subtitle: {
    color: '#57736B',
    fontSize: 16,
    marginTop: 8,
  },
});

export default App;

import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  StatusBar,
  ActivityIndicator,
  Animated,
  Easing,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { auth, database } from '../../lib/firebase';

const { width, height } = Dimensions.get('window');

export default function RegisterScreen() {
  const router = useRouter();
  
  const [formData, setFormData] = useState({
    fullName: '',
    nim: '',
    prodi: '',
    email: '',
    password: '',
    agreeToTerms: false
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [message, setMessage] = useState('');
  const [messageColor, setMessageColor] = useState('red');
  const [showPassword, setShowPassword] = useState(false);

  // Animasi values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const formSlideAnim = useRef(new Animated.Value(50)).current;
  
  // Animasi untuk background
  const gradientAnim = useRef(new Animated.Value(0)).current;
  const circle1Anim = useRef(new Animated.Value(0)).current;
  const circle2Anim = useRef(new Animated.Value(0)).current;
  const circle3Anim = useRef(new Animated.Value(0)).current;
  
  // Animasi untuk tombol dan input
  const registerButtonScale = useRef(new Animated.Value(1)).current;
  const socialButtonScales = useRef([new Animated.Value(1), new Animated.Value(1)]).current;
  const inputFocusAnims = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;

  useEffect(() => {
    // Animasi background circles
    Animated.stagger(300, [
      Animated.timing(circle1Anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(circle2Anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
      Animated.timing(circle3Anim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
        easing: Easing.out(Easing.cubic),
      }),
    ]).start();

    // Animasi gradient background
    Animated.timing(gradientAnim, {
      toValue: 1,
      duration: 1500,
      useNativeDriver: true,
    }).start();

    // Animasi utama
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(formSlideAnim, {
        toValue: 0,
        duration: 800,
        delay: 200,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const handleRegister = async (): Promise<void> => {
    // Validasi input
    if (!formData.fullName || !formData.nim || !formData.email || !formData.password) {
      setMessage('⚠️ Semua field harus diisi!');
      setMessageColor('red');
      return;
    }

    if (!formData.agreeToTerms) {
      setMessage('⚠️ Anda harus menyetujui pemrosesan data pribadi!');
      setMessageColor('red');
      return;
    }

    // Validasi format NIM (9 digit angka)
    const nimRegex = /^\d{9}$/;
    if (!nimRegex.test(formData.nim)) {
      setMessage('⚠️ NIM harus terdiri dari 9 digit angka!');
      setMessageColor('red');
      return;
    }

    // Validasi segment NIM (digit ke-3 sampai ke-6) — hanya izinkan kode tertentu
    const segment = formData.nim.substring(2, 6);
    const allowedSegments = ['2505', '2305', '2405'];
    if (!allowedSegments.includes(segment)) {
      setMessage('⚠️ NIM Tidak Tersedia untuk Registrasi!');
      setMessageColor('red');
      return;
    }

    // Validasi format email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setMessage('⚠️ Format email tidak valid!');
      setMessageColor('red');
      return;
    }

    // Validasi panjang password
    if (formData.password.length < 6) {
      setMessage('⚠️ Password harus minimal 6 karakter!');
      setMessageColor('red');
      return;
    }

    setLoading(true);
    setMessage('⏳ Membuat akun...');
    setMessageColor('blue');

    try {
      // Before creating the user, ensure email and NIM are not already registered in Firestore
      const usersRef = collection(database, 'users');
      const emailToCheck = typeof formData.email === 'string' ? formData.email.toLowerCase() : formData.email;
      const qEmail = query(usersRef, where('email', '==', emailToCheck));
      const emailSnapshot = await getDocs(qEmail);
      if (!emailSnapshot.empty) {
        setLoading(false);
        setMessage('⚠️ Email sudah terdaftar');
        setMessageColor('red');
        return;
      }

      const qNim = query(usersRef, where('nim', '==', formData.nim));
      const nimSnapshot = await getDocs(qNim);
      if (!nimSnapshot.empty) {
        setLoading(false);
        setMessage('⚠️ NIM sudah terdaftar');
        setMessageColor('red');
        return;
      }

      // Membuat user dengan Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );

      const user = userCredential.user;

      // Update profile dengan nama lengkap
      await updateProfile(user, {
        displayName: formData.fullName
      });

      // Simpan data tambahan ke Firestore
      await setDoc(doc(database, 'users', user.uid), {
        fullName: formData.fullName,
        nim: formData.nim,
        email: formData.email,
        prodi: formData.prodi || '',
        fakultas: 'Fakultas Komputer',
        createdAt: new Date(),
        role: 'student'
      });

      // Animasi tombol register saat berhasil
      Animated.sequence([
        Animated.timing(registerButtonScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(registerButtonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();

      setMessage('✅ Registrasi berhasil! Mengarahkan ke login...');
      setMessageColor('green');

      // Pindah ke login setelah 2 detik
      setTimeout(() => {
        setLoading(false);
        setMessage('');
        // Reset form
        setFormData({
          fullName: '',
          nim: '',
          prodi: '',
          email: '',
          password: '',
          agreeToTerms: false
        });
        router.replace('/(tabs)/login');
      }, 2000);

    } catch (error: any) {
      setLoading(false);
      
      // Handle error Firebase
      let errorMessage = '❌ Terjadi kesalahan saat registrasi';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          errorMessage = '❌ Email sudah digunakan';
          break;
        case 'auth/invalid-email':
          errorMessage = '❌ Format email tidak valid';
          break;
        case 'auth/weak-password':
          errorMessage = '❌ Password terlalu lemah';
          break;
        case 'auth/network-request-failed':
          errorMessage = '❌ Gagal terhubung ke jaringan';
          break;
        case 'auth/too-many-requests':
          errorMessage = '❌ Terlalu banyak percobaan, coba lagi nanti';
          break;
        default:
          errorMessage = `❌ ${error.message}`;
      }
      
      setMessage(errorMessage);
      setMessageColor('red');
      
      // Animasi error
      Animated.sequence([
        Animated.timing(registerButtonScale, {
          toValue: 0.95,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(registerButtonScale, {
          toValue: 1,
          duration: 100,
          useNativeDriver: true,
        }),
      ]).start();
    }
  };

  const handleChange = (field: string, value: string | boolean): void => {
    setFormData(prev => {
      const next = {
        ...prev,
        [field]: value
      } as any;

      // Jika field adalah NIM, periksa digit ke-3 sampai ke-6 (1-based) untuk menentukan prodi
      if (field === 'nim' && typeof value === 'string') {
        // pastikan panjang cukup
        if (value.length >= 6) {
          const segment = value.substring(2, 6); // indices 2..5 => angka ke-3 sampai ke-6
          switch (segment) {
            case '2505':
              next.prodi = 'S1 - Sistem Informasi';
              break;
            case '2305':
              next.prodi = 'D3 - Komputerisasi Akuntansi';
              break;
            case '2405':
              next.prodi = 'S1 - Bisnis Digital';
              break;
            default:
              // kosongkan prodi jika tidak cocok
              next.prodi = '';
          }
        } else {
          next.prodi = '';
        }
      }

      return next;
    });
    // Clear message when user starts typing
    if (message) {
      setMessage('');
    }
  };

  const handleInputFocus = (index: number) => {
    Animated.timing(inputFocusAnims[index], {
      toValue: 1,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleInputBlur = (index: number) => {
    Animated.timing(inputFocusAnims[index], {
      toValue: 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const handleButtonHoverIn = (animatedValue: Animated.Value) => {
    Animated.spring(animatedValue, {
      toValue: 1.05,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonHoverOut = (animatedValue: Animated.Value) => {
    Animated.spring(animatedValue, {
      toValue: 1,
      friction: 5,
      tension: 60,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressIn = (animatedValue: Animated.Value) => {
    Animated.spring(animatedValue, {
      toValue: 0.95,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const handleButtonPressOut = (animatedValue: Animated.Value) => {
    Animated.spring(animatedValue, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const toggleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#1E88E5" barStyle="light-content" />
      
      {/* Animated Gradient Background - Sama dengan login */}
      <Animated.View 
        style={[
          styles.background,
          {
            opacity: gradientAnim
          }
        ]}
      >
        <LinearGradient
          colors={['#1E88E5', '#1565C0', '#0D47A1']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        
        {/* Animated Background Circles */}
        <Animated.View 
          style={[
            styles.circle1,
            {
              opacity: circle1Anim,
              transform: [
                { 
                  scale: circle1Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1]
                  })
                }
              ]
            }
          ]} 
        />
        <Animated.View 
          style={[
            styles.circle2,
            {
              opacity: circle2Anim,
              transform: [
                { 
                  scale: circle2Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1]
                  })
                }
              ]
            }
          ]} 
        />
        <Animated.View 
          style={[
            styles.circle3,
            {
              opacity: circle3Anim,
              transform: [
                { 
                  scale: circle3Anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1]
                  })
                }
              ]
            }
          ]} 
        />
      </Animated.View>

      <KeyboardAvoidingView 
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Section */}
          <Animated.View 
            style={[
              styles.header,
              {
                opacity: fadeAnim,
                transform: [
                  { translateY: slideAnim },
                  { scale: scaleAnim }
                ]
              }
            ]}
          >
            <Text style={styles.welcomeTitle}>Buat Akun Baru</Text>
            <Text style={styles.subtitle}>
              Isi data diri Anda untuk membuat akun baru
            </Text>
          </Animated.View>

          {/* Toggle Buttons */}
          <Animated.View 
            style={[
              styles.toggleContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            <TouchableOpacity 
              style={styles.toggleButton}
              onPress={() => router.push('/(tabs)/login')}
            >
              <Text style={styles.toggleText}>
                Masuk
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toggleButton, styles.activeToggle]}
            >
              <Text style={[styles.toggleText, styles.activeToggleText]}>
                Daftar
              </Text>
            </TouchableOpacity>
          </Animated.View>

            {/* Message */}
            {message ? (
              <Animated.Text 
                style={[
                  styles.message, 
                  { color: messageColor },
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: fadeAnim }]
                  }
                ]}
              >
                {message}
              </Animated.Text>
            ) : null}
            
          {/* Form Section */}
          <Animated.View 
            style={[
              styles.formContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: formSlideAnim }]
              }
            ]}
          >
            {/* Full Name Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <Animated.View style={[
                styles.inputWrapper,
                {
                  borderColor: inputFocusAnims[0].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#e0e0e0', '#1E88E5']
                  }),
                  shadowOpacity: inputFocusAnims[0].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.1]
                  })
                }
              ]}>
                <View style={styles.inputWithIcon}>
                  <Ionicons 
                    name="person-outline" 
                    size={20} 
                    color="#999" 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Masukkan nama lengkap Anda"
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                    value={formData.fullName}
                    onChangeText={(value) => handleChange('fullName', value)}
                    onFocus={() => handleInputFocus(0)}
                    onBlur={() => handleInputBlur(0)}
                    editable={!loading}
                  />
                </View>
              </Animated.View>
            </View>

            {/* NIM Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>NIM</Text>
              <Animated.View style={[
                styles.inputWrapper,
                {
                  borderColor: inputFocusAnims[1].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#e0e0e0', '#1E88E5']
                  }),
                  shadowOpacity: inputFocusAnims[1].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.1]
                  })
                }
              ]}>
                <View style={styles.inputWithIcon}>
                  <Ionicons 
                    name="school-outline" 
                    size={20} 
                    color="#999" 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Masukkan NIM (9 digit)"
                    placeholderTextColor="#999"
                    keyboardType="numeric"
                    maxLength={9}
                    value={formData.nim}
                    onChangeText={(value) => handleChange('nim', value)}
                    onFocus={() => handleInputFocus(1)}
                    onBlur={() => handleInputBlur(1)}
                    editable={!loading}
                  />
                </View>
              </Animated.View>
            </View>

            {/* Email Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Email</Text>
              <Animated.View style={[
                styles.inputWrapper,
                {
                  borderColor: inputFocusAnims[2].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#e0e0e0', '#1E88E5']
                  }),
                  shadowOpacity: inputFocusAnims[2].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.1]
                  })
                }
              ]}>
                <View style={styles.inputWithIcon}>
                  <Ionicons 
                    name="mail-outline" 
                    size={20} 
                    color="#999" 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Masukkan email Anda"
                    placeholderTextColor="#999"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={formData.email}
                    onChangeText={(value) => handleChange('email', value)}
                    onFocus={() => handleInputFocus(2)}
                    onBlur={() => handleInputBlur(2)}
                    editable={!loading}
                  />
                </View>
              </Animated.View>
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Password</Text>
              <Animated.View style={[
                styles.inputWrapper,
                {
                  borderColor: inputFocusAnims[3].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['#e0e0e0', '#1E88E5']
                  }),
                  shadowOpacity: inputFocusAnims[3].interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 0.1]
                  })
                }
              ]}>
                <View style={styles.inputWithIcon}>
                  <Ionicons 
                    name="lock-closed-outline" 
                    size={20} 
                    color="#999" 
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Masukkan password (min. 6 karakter)"
                    placeholderTextColor="#999"
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    value={formData.password}
                    onChangeText={(value) => handleChange('password', value)}
                    onFocus={() => handleInputFocus(3)}
                    onBlur={() => handleInputBlur(3)}
                    editable={!loading}
                  />
                  <TouchableOpacity 
                    style={styles.eyeIcon}
                    onPress={toggleShowPassword}
                    disabled={loading}
                  >
                    <Ionicons 
                      name={showPassword ? "eye-off-outline" : "eye-outline"} 
                      size={20} 
                      color="#999" 
                    />
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </View>

            {/* Terms Agreement */}
            <View style={styles.termsContainer}>
              <TouchableOpacity 
                style={[styles.checkbox, formData.agreeToTerms && styles.checked]}
                onPress={() => handleChange('agreeToTerms', !formData.agreeToTerms)}
                disabled={loading}
              >
                {formData.agreeToTerms && <Text style={styles.checkmark}>✓</Text>}
              </TouchableOpacity>
              <Text style={styles.termsText}>
                Saya setuju dengan pemrosesan data pribadi
              </Text>
            </View>

            {/* Sign Up Button */}
            <TouchableOpacity 
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.9}
              onPressIn={() => handleButtonPressIn(registerButtonScale)}
              onPressOut={() => handleButtonPressOut(registerButtonScale)}
            >
              <Animated.View 
                style={[
                  styles.signButton,
                  loading && styles.signButtonDisabled,
                  {
                    transform: [{ scale: registerButtonScale }]
                  }
                ]}
              >
                <LinearGradient
                  colors={['#42A5F5', '#1976D2', '#1565C0']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                />
                {loading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.signButtonText}>Daftar</Text>
                )}
              </Animated.View>
            </TouchableOpacity>
          </Animated.View>

          {/* Social Register Section */}
          <Animated.View 
            style={[
              styles.socialSection,
              {
                opacity: fadeAnim,
                transform: [{ translateY: formSlideAnim }]
              }
            ]}
          >
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>atau</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={styles.socialContainer}>
              <Text style={styles.socialText}>Daftar dengan</Text>
              <View style={styles.socialIcons}>
                {/* Facebook Button */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPressIn={() => handleButtonHoverIn(socialButtonScales[0])}
                  onPressOut={() => handleButtonHoverOut(socialButtonScales[0])}
                  disabled={loading}
                >
                  <Animated.View 
                    style={[
                      styles.socialIcon,
                      {
                        transform: [{ scale: socialButtonScales[0] }]
                      }
                    ]}
                  >
                    <Ionicons name="logo-facebook" size={24} color="#1877F2" />
                  </Animated.View>
                </TouchableOpacity>

                {/* Google Button */}
                <TouchableOpacity 
                  activeOpacity={0.8}
                  onPressIn={() => handleButtonHoverIn(socialButtonScales[1])}
                  onPressOut={() => handleButtonHoverOut(socialButtonScales[1])}
                  disabled={loading}
                >
                  <Animated.View 
                    style={[
                      styles.socialIcon,
                      {
                        transform: [{ scale: socialButtonScales[1] }]
                      }
                    ]}
                  >
                    <Ionicons name="logo-google" size={24} color="#DB4437" />
                  </Animated.View>
                </TouchableOpacity>
              </View>
            </View>
          </Animated.View>

          {/* Switch to Login */}
          <Animated.View 
            style={[
              styles.switchContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: formSlideAnim }]
              }
            ]}
          >
            <Text style={styles.switchText}>Sudah punya akun? </Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/login')} disabled={loading}>
              <Text style={styles.switchLink}>Masuk</Text>
            </TouchableOpacity>
          </Animated.View>

          {/* Back to Home Text */}
          <Animated.View 
            style={[
              styles.backHomeContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: formSlideAnim }]
              }
            ]}
          >
            <TouchableOpacity 
              onPress={() => router.push('/')}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text style={styles.backHomeText}>Kembali ke Halaman Utama</Text>
            </TouchableOpacity>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  background: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  circle1: {
    position: 'absolute',
    top: -100,
    right: -50,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(66, 165, 245, 0.2)',
  },
  circle2: {
    position: 'absolute',
    bottom: -100,
    left: -50,
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(41, 182, 246, 0.15)',
  },
  circle3: {
    position: 'absolute',
    top: '30%',
    left: '10%',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(30, 136, 229, 0.1)',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  welcomeTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 16,
    padding: 6,
    marginBottom: 32,
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  activeToggle: {
    backgroundColor: 'white',
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  activeToggleText: {
    color: '#1E88E5',
    fontWeight: 'bold',
  },
  formContainer: {
    width: '100%',
    marginBottom: 0,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputWrapper: {
    backgroundColor: 'white',
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
    overflow: 'hidden',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  eyeIcon: {
    padding: 4,
    marginLeft: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
    marginBottom: 8,
    marginLeft: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  message: {
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: 'bold',
    fontSize: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  termsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 30,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 6,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  checked: {
    backgroundColor: '#1E88E5',
    borderColor: '#1E88E5',
  },
  checkmark: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  termsText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
    flex: 1,
    lineHeight: 20,
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  signButton: {
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 30,
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    shadowOpacity: 0.4,
    elevation: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  signButtonDisabled: {
    opacity: 0.7,
  },
  signButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  socialSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  dividerText: {
    marginHorizontal: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 14,
    fontWeight: '500',
  },
  socialContainer: {
    alignItems: 'center',
  },
  socialText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 20,
    fontWeight: '500',
  },
  socialIcons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  socialIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#1E88E5',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 20,
  },
  switchText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  switchLink: {
    fontSize: 14,
    color: '#E3F2FD',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  backHomeContainer: {
    alignItems: 'center',
    marginTop: 10,
  },
  backHomeText: {
    fontSize: 14,
    color: '#E3F2FD',
    fontWeight: '600',
    textDecorationLine: 'underline',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
});
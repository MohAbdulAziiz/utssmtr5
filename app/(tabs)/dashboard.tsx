import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, SafeAreaView, Animated, Dimensions, StatusBar, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect, ComponentProps } from 'react';
import { signOut } from 'firebase/auth';
import { auth, database } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Key untuk AsyncStorage
const TRANSCRIPT_STORAGE_KEY = 'transcript_data';

export default function DashboardPage() {
  const router = useRouter();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeBimbingan, setActiveBimbingan] = useState<string | null>(null);
  const [userData, setUserData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [ipkData, setIpkData] = useState<string>('-');
  const [semesterStats, setSemesterStats] = useState<Array<{ semester: number; ip: number; sks: number }>>([]);
  const [cumulativeIpkNumber, setCumulativeIpkNumber] = useState<number | null>(null);
  
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const months = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Data kaprodi berdasarkan prodi
  const kaprodiData: Record<string, string> = {
    'S1 - Sistem Informasi': 'M. Fahmi Nugraha, M.Kom.',
    'S1 - Bisnis Digital': 'Dr. Ahmad Susanto, M.Kom.',
    'S1 - Ilmu Komputer': 'Prof. Dr. Bambang Sutrisno, M.Sc.',
    'S1 - Data Science': 'Dra. Siti Aminah, M.T.',
    'S1 - Teknik Informatika': 'Dr. Rudi Hermawan, M.Kom.',
    'S1 - Akuntansi': 'Dr. Maya Sari, M.Si.',
    'D3 - Komputerisasi Akuntansi': 'Drs. Joko Prasetyo, M.Pd.',
    'D3 - Manajemen Informatika': 'Ir. Diana Maulida, M.T.',
    'D3 - Teknik Industri': 'Drs. Farid Rahman, M.Sc.'
  };

  // Data default untuk field yang tidak ada di database
  const defaultUserData = {
    fullName: 'Mon. Abdul Aziz',
    nim: '232505059',
    prodi: '-',
    jenisKelas: '-',
    kaprodi: '-', // Akan diisi otomatis berdasarkan prodi
    avatar: null
  };

  // Data dummy dosen pembimbing (fallback jika data tidak ada di database)
  const defaultDosenPembimbingData = {
    ppl: [
      { nama: 'Dr. Ahmad Susanto, M.Kom.', bidang: 'Pemrograman' },
      { nama: 'Dra. Siti Aminah, M.T.', bidang: 'Analisis Sistem' }
    ],
    pal: [
      { nama: 'Prof. Dr. Bambang Sutrisno, M.Sc.', bidang: 'Algoritma' },
      { nama: 'Drs. Hendra Wijaya, M.Kom.', bidang: 'Struktur Data' }
    ],
    pkl: [
      { nama: 'Ir. Diana Maulida, M.T.', bidang: 'Manajemen Proyek' },
      { nama: 'Dr. Rudi Hermawan, M.Kom.', bidang: 'Database' }
    ],
    kkn: [
      { nama: 'Dr. Maya Sari, M.Si.', bidang: 'Sosial Masyarakat' },
      { nama: 'Drs. Joko Prasetyo, M.Pd.', bidang: 'Pengabdian' }
    ],
    skripsi: [
      { nama: 'Prof. Dr. Indra Gunawan, M.T.', bidang: 'Kecerdasan Buatan' },
      { nama: 'Dr. Lisa Andriani, M.Kom.', bidang: 'Sistem Informasi' },
      { nama: 'Drs. Farid Rahman, M.Sc.', bidang: 'Jaringan Komputer' }
    ]
  };

  // Tipe untuk struktur dosen
  type Dosen = { nama: string; bidang: string };
  type BimbinganKey = keyof typeof defaultDosenPembimbingData;

  // Mapping khusus berdasarkan NIM (beberapa NIM punya dosen yang berbeda)
  const dosenByNimExact: Record<string, Partial<Record<BimbinganKey, Dosen[]>>> = {
    // contoh exact match (nim => daftar dosen untuk tiap jenis)
    // '232505059': { skripsi: [{ nama: 'Dr. Rudi Hermawan, M.Kom.', bidang: 'Sistem Informasi' }] }
  };

  // prefix-based mapping: useful when groups of NIMs (same prefix) share pembimbing
  const dosenByNimPrefix: Record<string, Partial<Record<BimbinganKey, Dosen[]>>> = {
    // contoh: semua NIM dengan prefix '2325' dapat pembimbing tertentu
    '2325': {
      ppl: [
        { nama: 'Dr. Ahmad Susanto, M.Kom.', bidang: 'Pemrograman' }
      ],
      skripsi: [
        { nama: 'Dr. Lisa Andriani, M.Kom.', bidang: 'Sistem Informasi' }
      ]
    },
    '2505': {
      ppl: [
        { nama: 'Dra. Siti Aminah, M.T.', bidang: 'Analisis Sistem' }
      ]
    }
  };

  // Helper untuk mendapatkan dosen pembimbing berdasarkan NIM.
  const getDosenPembimbingByNim = (nim?: string | null, prodi?: string | null) : Partial<Record<BimbinganKey, Dosen[]>> => {
    if (!nim) return {};

    // Helper deterministic functions
    const seedFromNim = (n: string) => {
      const digits = n.replace(/\D/g, '');
      const last = digits.slice(-6);
      return parseInt(last || '1', 10) || 1;
    };

    const lcg = (seed: number) => {
      let state = seed;
      return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
      };
    };

    const pickDeterministic = (arr: Dosen[], count: number, seed: number): Dosen[] => {
      if (!arr || arr.length === 0) return [];
      if (count >= arr.length) return arr.slice();
      const rnd = lcg(seed);
      const picked: Dosen[] = [];
      const used = new Set<number>();
      while (picked.length < count) {
        const idx = Math.floor(rnd() * arr.length);
        if (!used.has(idx)) {
          used.add(idx);
          picked.push(arr[idx]);
        }
      }
      return picked;
    };

    // desired number of supervisors per key
    const desiredCount: Record<BimbinganKey, number> = {
      ppl: 1,
      pal: 1,
      pkl: 2,
      kkn: 2,
      skripsi: 3
    };

    // 1) exact match
    if (dosenByNimExact[nim]) {
      const base = dosenByNimExact[nim] as Partial<Record<BimbinganKey, Dosen[]>>;
      const seed = seedFromNim(nim);
      const result: Partial<Record<BimbinganKey, Dosen[]>> = {};
      for (const key of Object.keys(base) as BimbinganKey[]) {
        const list = base[key] || defaultDosenPembimbingData[key];
        result[key] = pickDeterministic(list, desiredCount[key] ?? list.length, seed + key.length);
      }
      return result;
    }

    // 2) prefix match (try 4, then 3, then 2 length prefixes)
    for (const prefixLen of [4, 3, 2]) {
      if (nim.length >= prefixLen) {
        const prefix = nim.substring(0, prefixLen);
        if (dosenByNimPrefix[prefix]) {
          const base = dosenByNimPrefix[prefix] as Partial<Record<BimbinganKey, Dosen[]>>;
          const seed = seedFromNim(nim);
          const result: Partial<Record<BimbinganKey, Dosen[]>> = {};
          for (const key of Object.keys(base) as BimbinganKey[]) {
            const list = base[key] || defaultDosenPembimbingData[key];
            result[key] = pickDeterministic(list, desiredCount[key] ?? list.length, seed + key.length);
          }
          return result;
        }
      }
    }

    // 3) fallback heuristic: return selections based on prodi
    if (prodi) {
      const seed = seedFromNim(nim);
      if (prodi.includes('Sistem Informasi') || prodi.includes('Bisnis Digital')) {
        return {
          ppl: pickDeterministic(defaultDosenPembimbingData.ppl, desiredCount.ppl, seed + 1),
          skripsi: pickDeterministic(defaultDosenPembimbingData.skripsi, desiredCount.skripsi, seed + 2)
        };
      }
      if (prodi.includes('Komputerisasi Akuntansi')) {
        return {
          pkl: pickDeterministic(defaultDosenPembimbingData.pkl, desiredCount.pkl, seed + 3),
          kkn: pickDeterministic(defaultDosenPembimbingData.kkn, desiredCount.kkn, seed + 4)
        };
      }
    }

    // 4) final fallback: pick from defaults
    const seed = seedFromNim(nim);
    const fallbackResult: Partial<Record<BimbinganKey, Dosen[]>> = {};
    for (const key of Object.keys(defaultDosenPembimbingData) as BimbinganKey[]) {
      const list = defaultDosenPembimbingData[key];
      fallbackResult[key] = pickDeterministic(list, desiredCount[key] ?? list.length, seed + key.length);
    }
    return fallbackResult;
  };

  // Fungsi untuk mendapatkan kaprodi berdasarkan prodi
  const getKaprodiByProdi = (prodi?: string | null): string => {
    if (!prodi || prodi === '-') return '-';
    
    // Cari kaprodi berdasarkan nama prodi yang tepat
    const kaprodi = kaprodiData[prodi];
    
    // Jika tidak ditemukan, coba cari dengan partial match
    if (!kaprodi) {
      for (const [key, value] of Object.entries(kaprodiData)) {
        if (prodi && (key.includes(prodi) || prodi.includes(key))) {
          return value;
        }
      }
    }
    
    return kaprodi || '-';
  };

  // Fungsi untuk mengambil IPK dari local storage berdasarkan NIM
  const fetchIpkFromLocalStorage = async (nim: string): Promise<string> => {
    try {
      if (!nim || nim === '-') return '-';
      // Ambil data transkrip dari local storage berdasarkan NIM
      const storageKey = `${TRANSCRIPT_STORAGE_KEY}_${nim}`;
      const storedData = await AsyncStorage.getItem(storageKey);

      if (storedData) {
        const parsed = JSON.parse(storedData);
        console.log('Data transkrip ditemukan di local storage untuk NIM:', nim);

        // Expect stored as SemesterData[] where each item has sks and totalNilaiMutu or ip
        if (Array.isArray(parsed) && parsed.length > 0) {
          const semesters = parsed as any[];
          const totalSKS = semesters.reduce((sum, sem) => sum + (sem.sks || 0), 0);
          const totalNilaiMutu = semesters.reduce((sum, sem) => sum + (sem.totalNilaiMutu || (sem.ip && sem.sks ? sem.ip * sem.sks : 0)), 0);

          if (totalSKS > 0) {
            const ipk = totalNilaiMutu / totalSKS;
            const formattedIpk = ipk.toFixed(2);
            console.log('IPK dihitung dari local storage:', formattedIpk);
            return formattedIpk;
          }
        }
      }

      console.log('Data transkrip tidak ditemukan di local storage untuk NIM:', nim);
      return '-';
    } catch (error) {
      console.error('Error fetching IPK from local storage:', error);
      return '-';
    }
  };

  // Load per-semester stats (IP and SKS) from local storage and compute cumulative IPK
  const loadSemesterDataFromLocalStorage = async (nim: string): Promise<number | null> => {
    try {
      if (!nim || nim === '-') return null;
      const storageKey = `${TRANSCRIPT_STORAGE_KEY}_${nim}`;
      const storedData = await AsyncStorage.getItem(storageKey);
      if (!storedData) return null;

      const semesters = JSON.parse(storedData) as any[];
      if (!Array.isArray(semesters) || semesters.length === 0) return null;

      const stats = semesters.map(s => ({ 
        semester: s.semester, 
        ip: s.ip ?? (s.totalNilaiMutu / s.sks), 
        sks: s.sks 
      }));
      setSemesterStats(stats);
      let totalSKS = stats.reduce((sum, s) => sum + (s.sks || 0), 0);
      let totalNilai = stats.reduce((sum, s) => sum + ((s.ip || 0) * (s.sks || 0)), 0);
      let cumulative = totalSKS > 0 ? totalNilai / totalSKS : 0;

      // Keep parity with Transkrip: special-case override for NIM 232505059
      if (nim === '232505059') {
        cumulative = 3.99;
      }

      setCumulativeIpkNumber(cumulative);

      return cumulative;
    } catch (error) {
      console.error('Error loading semester data from storage:', error);
      return null;
    }
  };

  // Fungsi untuk mengambil IPK dari data transkrip di Firestore (fallback)
  const fetchIpkFromTranskrip = async (nim: string): Promise<string> => {
    try {
      if (!nim || nim === '-') return '-';

      // Cari data transkrip berdasarkan NIM
      const transkripRef = collection(database, 'transkrip');
      const q = query(transkripRef, where('nim', '==', nim));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const transkripDoc = querySnapshot.docs[0];
        const transkripData = transkripDoc.data();
        
        console.log('Data transkrip ditemukan di Firestore:', transkripData);
        
        // Ambil IPK dari data transkrip
        // Coba beberapa kemungkinan field name untuk IPK
        const ipk = transkripData.ipk || transkripData.IPK || transkripData.indeks_prestasi || transkripData.gpa;
        
        if (ipk !== undefined && ipk !== null && ipk !== '') {
          // Format IPK ke 2 angka desimal
          const formattedIpk = typeof ipk === 'number' ? ipk.toFixed(2) : parseFloat(ipk).toFixed(2);
          return formattedIpk;
        }
      }
      
      console.log('Data transkrip tidak ditemukan di Firestore untuk NIM:', nim);
      return '-';
    } catch (error) {
      console.error('Error fetching IPK from transkrip:', error);
      return '-';
    }
  };

  useEffect(() => {
    // Ambil data user dari Firestore berdasarkan NIM
    fetchUserData();
    
    // Animasi fade in untuk konten
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (isMenuVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.3,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -SCREEN_WIDTH * 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        })
      ]).start();
    }
  }, [isMenuVisible]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.log('No user logged in');
        const userDataWithKaprodi = {
          ...defaultUserData,
          kaprodi: getKaprodiByProdi(defaultUserData.prodi)
        };
        setUserData(userDataWithKaprodi);
        
        // Ambil IPK dan semester data untuk grafik dari local storage
        const ipk = await fetchIpkFromLocalStorage(defaultUserData.nim);
        const cumulative = await loadSemesterDataFromLocalStorage(defaultUserData.nim);
        if (cumulative !== null && !isNaN(cumulative)) {
          setIpkData(cumulative.toFixed(2));
        } else {
          setIpkData(ipk);
        }
        
        setLoading(false);
        return;
      }

      // Cari user berdasarkan UID atau email
      const usersRef = collection(database, 'users');
      const q = query(usersRef, where('email', '==', currentUser.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userDataFromDB = userDoc.data();
        
        console.log('Data dari database:', userDataFromDB);
        
        // Dapatkan kaprodi berdasarkan prodi
        const userProdi = userDataFromDB.prodi !== undefined ? userDataFromDB.prodi : '-';
        const kaprodi = getKaprodiByProdi(userProdi);
        
        // Gabungkan data dari database dengan data default
        const userDataToSet = {
          uid: userDoc.id,
          fullName: userDataFromDB.fullName || defaultUserData.fullName,
          nim: userDataFromDB.nim || defaultUserData.nim,
          prodi: userProdi,
          jenisKelas: userDataFromDB.jenisKelas !== undefined ? userDataFromDB.jenisKelas : '-',
          kaprodi: kaprodi,
          dosenPembimbing: userDataFromDB.dosenPembimbing || getDosenPembimbingByNim(userDataFromDB.nim || userDataFromDB.NIM || null, userProdi) || defaultDosenPembimbingData,
          avatar: userDataFromDB.avatar || null
        };
        
        setUserData(userDataToSet);
        
        // Ambil IPK dari local storage berdasarkan NIM (prioritas utama)
        const userNim = userDataToSet.nim;
        let ipk = await fetchIpkFromLocalStorage(userNim);
        // Jika tidak ada di local storage, coba dari Firestore
        if (ipk === '-') {
          console.log('Mencoba mengambil IPK dari Firestore...');
          ipk = await fetchIpkFromTranskrip(userNim);
        }
        // Load semester data untuk grafik and get cumulative
        const cumulativeUser = await loadSemesterDataFromLocalStorage(userNim);
        if (cumulativeUser !== null && !isNaN(cumulativeUser)) {
          setIpkData(cumulativeUser.toFixed(2));
        } else {
          setIpkData(ipk);
        }
        
      } else {
        console.log('User tidak ditemukan di database, menggunakan data default');
        const userDataWithKaprodi = {
          ...defaultUserData,
          kaprodi: getKaprodiByProdi(defaultUserData.prodi),
          dosenPembimbing: getDosenPembimbingByNim(defaultUserData.nim, defaultUserData.prodi) || defaultDosenPembimbingData
        };
        setUserData(userDataWithKaprodi);
        
        // Ambil IPK untuk data default dari local storage
        const ipk = await fetchIpkFromLocalStorage(defaultUserData.nim);
        setIpkData(ipk);
        
        // Load semester data untuk grafik
        await loadSemesterDataFromLocalStorage(defaultUserData.nim);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Fallback data jika error
      const userDataWithKaprodi = {
        ...defaultUserData,
        kaprodi: getKaprodiByProdi(defaultUserData.prodi),
        dosenPembimbing: getDosenPembimbingByNim(defaultUserData.nim, defaultUserData.prodi) || defaultDosenPembimbingData
      };
      setUserData(userDataWithKaprodi);
      setIpkData('-');
    } finally {
      setLoading(false);
    }
  };

  // Komponen Grafik Batang untuk IP Semester
  const IPSemesterChart = () => {
    const maxIP = 4.0;
    const chartHeight = 120;
    
    if (semesterStats.length === 0) {
      return (
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>IP per Semester</Text>
          <View style={styles.noDataContainer}>
            <Ionicons name="bar-chart" size={32} color="#ccc" />
            <Text style={styles.noDataText}>Data IP semester belum tersedia</Text>
          </View>
        </View>
      );
    }
    
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>IP per Semester</Text>
        <View style={styles.chart}>
          {semesterStats.map((semester) => (
            <View key={semester.semester} style={styles.barContainer}>
              <View style={styles.barWrapper}>
                <View style={styles.barBackground}>
                  <View 
                    style={[
                      styles.bar,
                      { 
                        height: (semester.ip / maxIP) * chartHeight,
                        backgroundColor: semester.ip >= 3.5 ? '#4CAF50' : semester.ip >= 3.0 ? '#FF9800' : '#F44336'
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.barLabel}>S{semester.semester}</Text>
                <Text style={styles.barValue}>{semester.ip.toFixed(2)}</Text>
              </View>
            </View>
          ))}
        </View>
        <View style={styles.chartLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#4CAF50' }]} />
            <Text style={styles.legendText}>≥ 3.50 (Cumlaude)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#FF9800' }]} />
            <Text style={styles.legendText}>3.00 - 3.49 (Baik)</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: '#F44336' }]} />
            <Text style={styles.legendText}>{'< 3.00 (Cukup)'}</Text>
          </View>
        </View>
      </View>
    );
  };

  // Fungsi untuk mendapatkan inisial nama
  const getInitials = (name?: string | null): string => {
    if (!name || name === '-') return 'U';
    
    const names = name.split(' ').filter(Boolean);
    let initials = names.length ? names[0].charAt(0).toUpperCase() : 'U';
    
    if (names.length > 1) {
      initials += names[names.length - 1].charAt(0).toUpperCase();
    }
    
    return initials;
  };

  // Fungsi untuk render avatar - jika tidak ada avatar di database, tampilkan icon dengan inisial
  const renderAvatar = (size = 'normal') => {
    const avatarSize = size === 'large' ? 
      { width: Platform.OS === 'web' ? 100 : 80, height: Platform.OS === 'web' ? 100 : 80 } :
      { width: Platform.OS === 'web' ? 80 : 60, height: Platform.OS === 'web' ? 80 : 60 };
    
    const borderRadius = size === 'large' ? 
      Platform.OS === 'web' ? 50 : 40 :
      Platform.OS === 'web' ? 40 : 30;

    if (userData?.avatar) {
      return (
        <Image 
          source={{ uri: userData.avatar }} 
          style={[
            styles.avatar,
            avatarSize,
            { borderRadius }
          ]} 
        />
      );
    } else {
      // Tampilkan avatar dummy dengan inisial
      const initials = getInitials(userData?.fullName);
      return (
        <View style={[
          styles.avatarPlaceholder,
          avatarSize,
          { 
            borderRadius,
            backgroundColor: '#2196F3'
          }
        ]}>
          <Text style={[
            styles.avatarInitials,
            size === 'large' ? styles.avatarInitialsLarge : styles.avatarInitialsNormal
          ]}>
            {initials}
          </Text>
        </View>
      );
    }
  };

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const today = new Date();
    
    const calendarDays = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < firstDay; i++) {
      calendarDays.push(<View key={`empty-${i}`} style={styles.calendarDayEmpty} />);
    }
    
    // Add cells for each day of the month
    for (let day = 1; day <= daysInMonth; day++) {
      const isToday = today.getDate() === day && 
                     today.getMonth() === currentDate.getMonth() && 
                     today.getFullYear() === currentDate.getFullYear();
      
      calendarDays.push(
        <View key={day} style={[
          styles.calendarDay,
          isToday && styles.calendarToday
        ]}>
          <Text style={[
            styles.calendarDayText,
            isToday && styles.calendarTodayText
          ]}>
            {day}
          </Text>
        </View>
      );
    }
    
    return calendarDays;
  };

  const navigateToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const navigateToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handleBimbinganPress = (jenis: string) => {
    setActiveBimbingan(activeBimbingan === jenis ? null : jenis);
  };

  const handleLogout = async () => {
    // Alert untuk konfirmasi logout
    if (Platform.OS === 'web') {
      const confirmLogout = window.confirm('Apakah Anda yakin ingin keluar dari aplikasi?');
      if (!confirmLogout) return;
    } else {
      Alert.alert(
        "Konfirmasi Logout",
        "Apakah Anda yakin ingin keluar dari aplikasi?",
        [
          {
            text: "Batal",
            style: "cancel"
          },
          {
            text: "Ya, Keluar",
            onPress: async () => {
              await performLogout();
            },
            style: "destructive"
          }
        ]
      );
      return;
    }
    
    await performLogout();
  };

  const performLogout = async () => {
    try {
      setLoading(true);
      await signOut(auth);
      console.log("User logged out successfully");
      
      // Reset state dan redirect ke login
      setIsMenuVisible(false);
      router.replace('/(tabs)/login');
      
    } catch (error) {
      console.error("Logout error:", error);
      
      // Fallback jika Firebase logout gagal
      if (Platform.OS === 'web') {
        alert('Terjadi kesalahan saat logout. Silakan coba lagi.');
      } else {
        Alert.alert('Error', 'Terjadi kesalahan saat logout. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const menuItems: { title: string; icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void }[] = [
    { 
      title: 'Dashboard', 
      icon: 'home',
      onPress: () => {
        closeMenu();
      }
    },
    { 
      title: 'Profile', 
      icon: 'person',
      onPress: () => {
        closeMenu();
        setTimeout(() => router.push('/(tabs)/profile'), 300);
      }
    },
    { 
      title: 'Transkrip', 
      icon: 'document-text',
      onPress: () => {
        closeMenu();
        setTimeout(() => router.push('/(tabs)/transkrip'), 300);
      }
    }
  ];

  const closeMenu = () => {
    setIsMenuVisible(false);
  };

  const renderDosenPembimbing = () => {
    if (!activeBimbingan) return null;

    // Define the allowed keys so TypeScript can safely index the objects
    type BimbinganKey = keyof typeof defaultDosenPembimbingData;
    const key = activeBimbingan as BimbinganKey;

    // Cast userData.dosenPembimbing to a Partial<Record<...>> to avoid implicit any indexing
    const userDosen = userData?.dosenPembimbing as Partial<Record<BimbinganKey, { nama: string; bidang: string; }[]>> | undefined;
    const dosenList = (userDosen?.[key] ?? defaultDosenPembimbingData[key] ?? []);

    return (
      <Animated.View 
        style={[
          styles.dosenPembimbingContainer,
          {
            opacity: fadeAnim
          }
        ]}
      >
        <Text style={styles.dosenPembimbingTitle}>
          Dosen Pembimbing {activeBimbingan.toUpperCase()}
        </Text>
        {dosenList.length > 0 ? (
          dosenList.map((dosen, index) => (
            <View key={index} style={styles.dosenItem}>
              <Ionicons name="person" size={16} color="#2196F3" />
              <View style={styles.dosenInfo}>
                <Text style={styles.dosenNama}>
                  {dosen.nama || 'Belum ditentukan'}
                </Text>
                <Text style={styles.dosenBidang}>
                  Bidang: {dosen.bidang || '-'}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.dosenItem}>
            <Ionicons name="alert-circle" size={16} color="#FF9800" />
            <View style={styles.dosenInfo}>
              <Text style={styles.dosenNama}>
                Data dosen pembimbing belum tersedia
              </Text>
              <Text style={styles.dosenBidang}>
                Silakan hubungi administrasi
              </Text>
            </View>
          </View>
        )}
      </Animated.View>
    );
  };

  // Fungsi untuk menampilkan data atau strip jika kosong
  const displayData = (data: string | undefined | null, fallback = '-'): string => {
    return data && data !== '' && data !== '-' ? data : fallback;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Memuat data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.safeArea}>
      <StatusBar 
        backgroundColor="#2196F3" 
        barStyle="light-content" 
        translucent={false}
      />
      
      {/* Header dengan hamburger menu */}
      <View style={styles.topHeader}>
        <TouchableOpacity 
          style={styles.menuButton}
          onPress={() => setIsMenuVisible(true)}
        >
          <Ionicons name="menu" size={28} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Dashboard</Text>
        <View style={styles.placeholder} />
      </View>

      <Animated.ScrollView 
        style={[styles.container, { opacity: fadeAnim }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header dengan foto profil */}
        <Animated.View 
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}
        >
          {renderAvatar('large')}
          <View style={styles.userInfo}>
            <Text style={styles.name}>
              {displayData(userData?.fullName)}
            </Text>
            <Text style={styles.nim}>
              NIM: {displayData(userData?.nim)}
            </Text>
          </View>
        </Animated.View>

        {/* Grafik IP Semester */}
        <IPSemesterChart />

        {/* Data Mahasiswa */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Data Mahasiswa</Text>
          <View style={styles.table}>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Nama</Text>
              <Text style={styles.tableData}>
                {displayData(userData?.fullName)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>NIM</Text>
              <Text style={styles.tableData}>
                {displayData(userData?.nim)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Prodi</Text>
              <Text style={styles.tableData}>
                {displayData(userData?.prodi)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Jenis Kelas</Text>
              <Text style={styles.tableData}>
                {displayData(userData?.jenisKelas)}
              </Text>
            </View>
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>IPK</Text>
              <Text style={styles.tableData}>
                {ipkData}
                {cumulativeIpkNumber && cumulativeIpkNumber >= 3.5 && (
                  <Text style={styles.cumlaudeBadge}> 🏆 Cumlaude</Text>
                )}
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Dosen Wali / Bimbingan */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Dosen Wali / Bimbingan</Text>
          <View style={styles.bimbinganContainer}>
            {/* Kaprodi - Tetap */}
            <View style={styles.bimbinganItem}>
              <Text style={styles.bimbinganLabel}>Kaprodi</Text>
              <Text style={styles.bimbinganValue}>
                {displayData(userData?.kaprodi)}
              </Text>
            </View>

            {/* Tombol-tombol bimbingan - 5 kolom sejajar */}
            <View style={styles.bimbinganButtonsContainer}>
              <TouchableOpacity 
                style={[
                  styles.bimbinganButton,
                  activeBimbingan === 'ppl' && styles.bimbinganButtonActive
                ]}
                onPress={() => handleBimbinganPress('ppl')}
              >
                <Text style={[
                  styles.bimbinganButtonText,
                  activeBimbingan === 'ppl' && styles.bimbinganButtonTextActive
                ]}>
                  PPL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.bimbinganButton,
                  activeBimbingan === 'pal' && styles.bimbinganButtonActive
                ]}
                onPress={() => handleBimbinganPress('pal')}
              >
                <Text style={[
                  styles.bimbinganButtonText,
                  activeBimbingan === 'pal' && styles.bimbinganButtonTextActive
                ]}>
                  PAL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.bimbinganButton,
                  activeBimbingan === 'pkl' && styles.bimbinganButtonActive
                ]}
                onPress={() => handleBimbinganPress('pkl')}
              >
                <Text style={[
                  styles.bimbinganButtonText,
                  activeBimbingan === 'pkl' && styles.bimbinganButtonTextActive
                ]}>
                  PKL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.bimbinganButton,
                  activeBimbingan === 'kkn' && styles.bimbinganButtonActive
                ]}
                onPress={() => handleBimbinganPress('kkn')}
              >
                <Text style={[
                  styles.bimbinganButtonText,
                  activeBimbingan === 'kkn' && styles.bimbinganButtonTextActive
                ]}>
                  KKN
                </Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[
                  styles.bimbinganButton,
                  activeBimbingan === 'skripsi' && styles.bimbinganButtonActive
                ]}
                onPress={() => handleBimbinganPress('skripsi')}
              >
                <Text style={[
                  styles.bimbinganButtonText,
                  activeBimbingan === 'skripsi' && styles.bimbinganButtonTextActive
                ]}>
                  SKRIPSI
                </Text>
              </TouchableOpacity>
            </View>

            {/* Dosen Pembimbing yang muncul ketika tombol diklik */}
            {renderDosenPembimbing()}
          </View>
        </Animated.View>

        {/* Kalender */}
        <Animated.View 
          style={[
            styles.section,
            {
              opacity: fadeAnim,
              transform: [{
                translateY: fadeAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0]
                })
              }]
            }
          ]}
        >
          <Text style={styles.sectionTitle}>Kalender Akademik</Text>
          <View style={styles.calendarContainer}>
            <View style={styles.calendarHeader}>
              <TouchableOpacity onPress={navigateToPreviousMonth}>
                <Ionicons name="chevron-back" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.calendarMonth}>
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </Text>
              <TouchableOpacity onPress={navigateToNextMonth}>
                <Ionicons name="chevron-forward" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <View style={styles.calendarDaysHeader}>
              {['M', 'S', 'S', 'R', 'K', 'J', 'S'].map((day, index) => (
                <Text key={index} style={styles.calendarDayHeader}>
                  {day}
                </Text>
              ))}
            </View>
            
            <View style={styles.calendarGrid}>
              {renderCalendar()}
            </View>
          </View>
        </Animated.View>
        
      </Animated.ScrollView>

      {/* Sidebar Overlay */}
      {isMenuVisible && (
        <TouchableOpacity 
          style={styles.overlay}
          activeOpacity={1}
          onPress={closeMenu}
        />
      )}

      {/* Sidebar Menu */}
      <Animated.View 
        style={[
          styles.sidebar,
          {
            transform: [{ translateX: slideAnim }]
          }
        ]}
      >
        {/* Sidebar Header */}
        <View style={styles.sidebarHeader}>
          {renderAvatar('normal')}
          <View style={styles.sidebarUserInfo}>
            <Text style={styles.sidebarName}>
              {displayData(userData?.fullName)}
            </Text>
            <Text style={styles.sidebarNim}>
              {displayData(userData?.nim)}
            </Text>
            <Text style={styles.sidebarProdi}>
              {displayData(userData?.prodi)}
            </Text>
          </View>
          <TouchableOpacity 
            style={styles.sidebarCloseButton}
            onPress={closeMenu}
          >
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Menu Items */}
        <ScrollView style={styles.sidebarContent}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.sidebarMenuItem}
              onPress={item.onPress}
            >
              <Ionicons name={item.icon} size={22} color="#2196F3" />
              <Text style={styles.sidebarMenuItemText}>{item.title}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Sidebar Footer */}
        <View style={styles.sidebarFooter}>
          <TouchableOpacity 
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons name="log-out" size={20} color="#fff" />
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingTop: Platform.OS === 'web' ? 0 : StatusBar.currentHeight || 0,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    zIndex: 10,
  },
  menuButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    fontWeight: 'bold',
    color: '#333',
  },
  placeholder: {
    width: 28,
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Platform.OS === 'web' ? 24 : 16,
    paddingBottom: 30,
    maxWidth: Platform.OS === 'web' ? 1200 : '100%',
    alignSelf: Platform.OS === 'web' ? 'center' : 'stretch',
    width: Platform.OS === 'web' ? '90%' : '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: Platform.OS === 'web' ? 24 : 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatar: {
    marginRight: 16,
  },
  avatarPlaceholder: {
    marginRight: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2196F3',
  },
  avatarInitials: {
    color: '#fff',
    fontWeight: 'bold',
  },
  avatarInitialsLarge: {
    fontSize: Platform.OS === 'web' ? 32 : 24,
  },
  avatarInitialsNormal: {
    fontSize: Platform.OS === 'web' ? 24 : 18,
  },
  userInfo: {
    flex: 1,
  },
  name: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  nim: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
    paddingLeft: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  // Chart Styles
  chartContainer: {
    backgroundColor: '#fff',
    padding: Platform.OS === 'web' ? 20 : 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTitle: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  chart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 150,
    marginBottom: 16,
  },
  barContainer: {
    flex: 1,
    alignItems: 'center',
  },
  barWrapper: {
    alignItems: 'center',
    width: '100%',
  },
  barBackground: {
    height: 120,
    justifyContent: 'flex-end',
    width: 30,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    marginBottom: 8,
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#666',
    fontWeight: '500',
  },
  barValue: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 4,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 4,
    marginVertical: 2,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
    marginRight: 4,
  },
  legendText: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    color: '#666',
  },
  noDataContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  noDataText: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  cumlaudeBadge: {
    color: '#FFD700',
    fontWeight: 'bold',
    fontSize: Platform.OS === 'web' ? 14 : 12,
  },
  memoCard: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  memoText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
  },
  memoButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  memoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  // Calendar Styles
  calendarContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Platform.OS === 'web' ? 20 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  calendarMonth: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    fontWeight: 'bold',
    color: '#333',
  },
  calendarDaysHeader: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 8,
  },
  calendarDayHeader: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: 'bold',
    color: '#666',
    width: Platform.OS === 'web' ? 40 : 32,
    textAlign: 'center',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDayEmpty: {
    width: '14.28%',
    height: Platform.OS === 'web' ? 40 : 32,
    marginVertical: 2,
  },
  calendarDay: {
    width: '14.28%',
    height: Platform.OS === 'web' ? 40 : 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 2,
  },
  calendarToday: {
    backgroundColor: '#2196F3',
    borderRadius: Platform.OS === 'web' ? 20 : 16,
  },
  calendarDayText: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#333',
  },
  calendarTodayText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  // Table Styles
  table: {
    backgroundColor: '#fff',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingVertical: Platform.OS === 'web' ? 16 : 12,
    paddingHorizontal: Platform.OS === 'web' ? 20 : 16,
  },
  tableHeader: {
    flex: 1,
    fontWeight: 'bold',
    color: '#333',
    fontSize: Platform.OS === 'web' ? 16 : 14,
  },
  tableData: {
    flex: 2,
    color: '#666',
    fontSize: Platform.OS === 'web' ? 16 : 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    color: '#666',
  },
  // Bimbingan Styles
  bimbinganContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: Platform.OS === 'web' ? 20 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  bimbinganItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 16 : 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  bimbinganLabel: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: 'bold',
    color: '#333',
    flex: 1,
  },
  bimbinganValue: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#666',
    flex: 2,
    textAlign: 'right',
  },
  bimbinganButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    flexWrap: Platform.OS === 'web' ? 'nowrap' : 'wrap',
    gap: Platform.OS === 'web' ? 8 : 4,
  },
  bimbinganButton: {
    backgroundColor: '#f5f5f5',
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    paddingHorizontal: Platform.OS === 'web' ? 12 : 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flex: Platform.OS === 'web' ? 1 : undefined,
    minWidth: Platform.OS === 'web' ? 0 : '18%',
    marginHorizontal: Platform.OS === 'web' ? 2 : 1,
    alignItems: 'center',
    minHeight: Platform.OS === 'web' ? 44 : 40,
    justifyContent: 'center',
  },
  bimbinganButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  bimbinganButtonText: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    fontWeight: '500',
    color: '#666',
    textAlign: 'center',
  },
  bimbinganButtonTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  dosenPembimbingContainer: {
    marginTop: 16,
    padding: Platform.OS === 'web' ? 20 : 16,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  dosenPembimbingTitle: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  dosenItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  dosenInfo: {
    flex: 1,
    marginLeft: 12,
  },
  dosenNama: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  dosenBidang: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#666',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
    marginBottom: 30,
  },
  navButton: {
    backgroundColor: '#2196F3',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Sidebar Styles
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 100,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: Platform.OS === 'web' ? Math.min(SCREEN_WIDTH * 0.6, 400) : SCREEN_WIDTH * 0.8,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 20,
    zIndex: 101,
  },
  sidebarHeader: {
    backgroundColor: '#2196F3',
    padding: Platform.OS === 'web' ? 24 : 20,
    paddingTop: Platform.OS === 'web' ? 80 : 60,
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  sidebarAvatar: {
    width: Platform.OS === 'web' ? 80 : 60,
    height: Platform.OS === 'web' ? 80 : 60,
    borderRadius: Platform.OS === 'web' ? 40 : 30,
    marginRight: 12,
    borderWidth: 2,
    borderColor: '#fff',
  },
  sidebarUserInfo: {
    flex: 1,
  },
  sidebarName: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 2,
  },
  sidebarNim: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#e3f2fd',
    marginBottom: 2,
  },
  sidebarProdi: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#e3f2fd',
  },
  sidebarCloseButton: {
    position: 'absolute',
    top: Platform.OS === 'web' ? 50 : 40,
    right: 16,
    padding: 4,
  },
  sidebarContent: {
    flex: 1,
    paddingVertical: 16,
  },
  sidebarMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Platform.OS === 'web' ? 18 : 16,
    paddingHorizontal: Platform.OS === 'web' ? 24 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  sidebarMenuItemText: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    color: '#333',
    marginLeft: 16,
    fontWeight: '500',
  },
  sidebarFooter: {
    padding: Platform.OS === 'web' ? 24 : 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  logoutButton: {
    backgroundColor: '#f44336',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Platform.OS === 'web' ? 14 : 12,
    borderRadius: 8,
  },
  logoutButtonText: {
    color: '#fff',
    fontSize: Platform.OS === 'web' ? 18 : 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, SafeAreaView, Animated, Dimensions, StatusBar, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useState, useRef, useEffect, ComponentProps } from 'react';
import { auth, database } from '../../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, where, getDocs } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Type definitions
type TranscriptItem = {
  no: number;
  mataKuliah: string;
  kodeMK: string;
  hurufMutu: string;
  angkaMutu: number;
  sks: number;
  nilaiMutu: number;
};

type SemesterData = {
  semester: number;
  ip: number;
  sks: number;
  totalNilaiMutu: number;
  transcript: TranscriptItem[];
};

type UserData = {
  uid?: string;
  fullName: string;
  nim: string;
  email: string;
  prodi: string;
  fakultas?: string;
  jenisKelas?: string;
  alamat?: string;
  avatar?: string | null;
};

// Key untuk AsyncStorage
const TRANSCRIPT_STORAGE_KEY = 'transcript_data';

// Data base courses untuk semua semester (9 mata kuliah per semester)
const getBaseCoursesBySemester = (semester: number, prodi?: string | null) => {
  const commonCourses = [
    // Semester 1
    [
      { mataKuliah: 'Matematika Dasar I', kodeMK: 'MATH101', sks: 4 },
      { mataKuliah: 'Fisika Dasar I', kodeMK: 'PHYS101', sks: 3 },
      { mataKuliah: 'Kimia Dasar', kodeMK: 'CHEM101', sks: 3 },
      { mataKuliah: 'Pengantar Teknologi Informasi', kodeMK: 'IT101', sks: 3 },
      { mataKuliah: 'Bahasa Indonesia', kodeMK: 'IND101', sks: 2 },
      { mataKuliah: 'Pendidikan Pancasila', kodeMK: 'PPKN101', sks: 2 },
      { mataKuliah: 'Bahasa Inggris I', kodeMK: 'ENG101', sks: 2 },
      { mataKuliah: 'Algoritma dan Pemrograman I', kodeMK: 'ALG101', sks: 3 },
      { mataKuliah: 'Logika Matematika', kodeMK: 'LOG101', sks: 2 }
    ],
    // Semester 2
    [
      { mataKuliah: 'Matematika Dasar II', kodeMK: 'MATH102', sks: 4 },
      { mataKuliah: 'Fisika Dasar II', kodeMK: 'PHYS102', sks: 3 },
      { mataKuliah: 'Algoritma dan Pemrograman II', kodeMK: 'ALG102', sks: 3 },
      { mataKuliah: 'Struktur Data', kodeMK: 'STR102', sks: 3 },
      { mataKuliah: 'Arsitektur Komputer', kodeMK: 'ARS102', sks: 3 },
      { mataKuliah: 'Sistem Digital', kodeMK: 'DIG102', sks: 3 },
      { mataKuliah: 'Bahasa Inggris II', kodeMK: 'ENG102', sks: 2 },
      { mataKuliah: 'Kewarganegaraan', kodeMK: 'CIV102', sks: 2 },
      { mataKuliah: 'Pendidikan Agama', kodeMK: 'REL102', sks: 2 }
    ],
    // Semester 3
    [
      { mataKuliah: 'Matematika Diskrit', kodeMK: 'DIS201', sks: 3 },
      { mataKuliah: 'Basis Data', kodeMK: 'DB201', sks: 3 },
      { mataKuliah: 'Pemrograman Berorientasi Objek', kodeMK: 'OOP201', sks: 3 },
      { mataKuliah: 'Sistem Operasi', kodeMK: 'OS201', sks: 3 },
      { mataKuliah: 'Jaringan Komputer', kodeMK: 'NET201', sks: 3 },
      { mataKuliah: 'Statistika dan Probabilitas', kodeMK: 'STAT201', sks: 3 },
      { mataKuliah: 'Interaksi Manusia Komputer', kodeMK: 'HCI201', sks: 2 },
      { mataKuliah: 'Analisis Sistem Informasi', kodeMK: 'ASI201', sks: 3 },
      { mataKuliah: 'Kewirausahaan', kodeMK: 'ENT201', sks: 2 }
    ],
    // Semester 4
    [
      { mataKuliah: 'Rekayasa Perangkat Lunak', kodeMK: 'SE202', sks: 3 },
      { mataKuliah: 'Pemrograman Web', kodeMK: 'WEB202', sks: 3 },
      { mataKuliah: 'Pemrograman Mobile', kodeMK: 'MOB202', sks: 3 },
      { mataKuliah: 'Data Mining', kodeMK: 'DM202', sks: 3 },
      { mataKuliah: 'Keamanan Informasi', kodeMK: 'SEC202', sks: 3 },
      { mataKuliah: 'Manajemen Proyek TI', kodeMK: 'PM202', sks: 3 },
      { mataKuliah: 'Grafika Komputer', kodeMK: 'CG202', sks: 3 },
      { mataKuliah: 'Kecerdasan Buatan', kodeMK: 'AI202', sks: 3 },
      { mataKuliah: 'Etika Profesi', kodeMK: 'ETH202', sks: 2 }
    ],
    // Semester 5
    [
      { mataKuliah: 'Praktek Adaptasi Lapangan', kodeMK: 'MK205019', sks: 3 },
      { mataKuliah: 'Kontrol dan Audit Sistem Informasi', kodeMK: 'MK205007', sks: 3 },
      { mataKuliah: 'Statistik Komputasi', kodeMK: 'DK200019', sks: 3 },
      { mataKuliah: 'Pemrograman Mobile 2', kodeMK: 'MK205014', sks: 4 },
      { mataKuliah: 'Rekayasa Sistem Informasi', kodeMK: 'DK200015', sks: 3 },
      { mataKuliah: 'Testing & Implementasi Sistem Informasi', kodeMK: 'MK205026', sks: 3 },
      { mataKuliah: 'Manajemen Resiko TI', kodeMK: 'MP205001', sks: 2 },
      { mataKuliah: 'Leadership & Comunication Skill', kodeMK: 'MK205009', sks: 2 },
      { mataKuliah: 'Bahasa Inggris III (Conversation)', kodeMK: 'DK205004', sks: 1 }
    ]
  ];

  // Adjust courses based on program
  if (prodi === 'S1 - Bisnis Digital') {
    if (semester === 5) {
      return [
        { mataKuliah: 'E-Commerce Strategy', kodeMK: 'BD205001', sks: 3 },
        { mataKuliah: 'Digital Marketing Analytics', kodeMK: 'BD205002', sks: 3 },
        { mataKuliah: 'Business Intelligence', kodeMK: 'BD205003', sks: 4 },
        { mataKuliah: 'Fintech and Payment Systems', kodeMK: 'BD205004', sks: 3 },
        { mataKuliah: 'User Experience Design', kodeMK: 'BD205005', sks: 3 },
        { mataKuliah: 'Digital Transformation', kodeMK: 'BD205006', sks: 2 },
        { mataKuliah: 'Data Analytics for Business', kodeMK: 'BD205007', sks: 3 },
        { mataKuliah: 'Strategic Management', kodeMK: 'BD205008', sks: 3 },
        { mataKuliah: 'Business Project', kodeMK: 'BD205009', sks: 2 }
      ];
    }
  }

  if (prodi === 'D3 - Komputerisasi Akuntansi') {
    if (semester === 5) {
      return [
        { mataKuliah: 'Akuntansi Keuangan Menengah', kodeMK: 'KA205001', sks: 3 },
        { mataKuliah: 'Sistem Informasi Akuntansi', kodeMK: 'KA205002', sks: 3 },
        { mataKuliah: 'Perpajakan Digital', kodeMK: 'KA205003', sks: 4 },
        { mataKuliah: 'Auditing Sistem Informasi', kodeMK: 'KA205004', sks: 3 },
        { mataKuliah: 'Software Akuntansi', kodeMK: 'KA205005', sks: 3 },
        { mataKuliah: 'Manajemen Database Akuntansi', kodeMK: 'KA205006', sks: 2 },
        { mataKuliah: 'Akuntansi Biaya', kodeMK: 'KA205007', sks: 3 },
        { mataKuliah: 'Akuntansi Manajemen', kodeMK: 'KA205008', sks: 3 },
        { mataKuliah: 'Laporan Keuangan', kodeMK: 'KA205009', sks: 2 }
      ];
    }
  }

  return commonCourses[semester - 1] || commonCourses[4]; // Default to semester 5 if out of range
};

// Helper function untuk generate transcript sempurna
const generatePerfectTranscript = (semester: number, prodi?: string | null): TranscriptItem[] => {
  const baseCourses = getBaseCoursesBySemester(semester, prodi);
  
  return baseCourses.map((c, idx) => ({
    no: idx + 1,
    mataKuliah: c.mataKuliah,
    kodeMK: c.kodeMK,
    hurufMutu: 'A',
    angkaMutu: 4.0,
    sks: c.sks,
    nilaiMutu: Number((4.0 * c.sks).toFixed(2))
  }));
};

// Helper function untuk generate transcript random (untuk NIM lain)
const generateRandomTranscript = (semester: number, prodi?: string | null, rand?: () => number): TranscriptItem[] => {
  const baseCourses = getBaseCoursesBySemester(semester, prodi);
  const gradeBuckets = [
    { letter: 'A', value: 4.0 },
    { letter: 'A-', value: 3.7 },
    { letter: 'B+', value: 3.5 },
    { letter: 'B', value: 3.0 },
    { letter: 'B-', value: 2.7 },
    { letter: 'C+', value: 2.3 },
    { letter: 'C', value: 2.0 },
    { letter: 'D', value: 1.0 },
    { letter: 'E', value: 0.0 }
  ];

  const random = rand || Math.random;

  return baseCourses.map((c, idx) => {
    const r = Math.min(0.9999, Math.max(0, random() + 0.2));
    const bucketIndex = Math.floor(r * gradeBuckets.length);
    const bucket = gradeBuckets[Math.min(bucketIndex, gradeBuckets.length - 1)];
    const angkaMutu = bucket.value;
    const nilaiMutu = Number((angkaMutu * c.sks).toFixed(2));

    return {
      no: idx + 1,
      mataKuliah: c.mataKuliah,
      kodeMK: c.kodeMK,
      hurufMutu: bucket.letter,
      angkaMutu,
      sks: c.sks,
      nilaiMutu
    };
  });
};

// Data transkrip untuk semua semester berdasarkan prodi dan NIM
const getAllSemesterData = (prodi?: string | null, nim?: string | null): SemesterData[] => {
  // SPECIAL CASE: Untuk NIM 232505059, berikan nilai sempurna untuk semua semester
  if (nim === '232505059') {
    return [1, 2, 3, 4, 5].map(semester => {
      const transcript = generatePerfectTranscript(semester, prodi);
      const sks = transcript.reduce((sum, item) => sum + item.sks, 0);
      const totalNilaiMutu = transcript.reduce((sum, item) => sum + item.nilaiMutu, 0);
      const ip = totalNilaiMutu / sks;

      return {
        semester,
        ip: Number(ip.toFixed(2)),
        sks,
        totalNilaiMutu: Number(totalNilaiMutu.toFixed(2)),
        transcript
      };
    });
  }

  // Untuk NIM lain, generate data random
  const seedFromNim = (n?: string | null) => {
    if (!n) return 1;
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

  const seed = seedFromNim(nim);
  const rand = lcg(seed);

  const semesters: SemesterData[] = [];
  
  for (let sem = 1; sem <= 5; sem++) {
    const transcript = generateRandomTranscript(sem, prodi, rand);
    const sks = transcript.reduce((sum, item) => sum + item.sks, 0);
    const totalNilaiMutu = transcript.reduce((sum, item) => sum + item.nilaiMutu, 0);
    const ip = totalNilaiMutu / sks;
    
    semesters.push({
      semester: sem,
      ip: Number(ip.toFixed(2)),
      sks,
      totalNilaiMutu: Number(totalNilaiMutu.toFixed(2)),
      transcript
    });
  }

  return semesters;
};

// Fungsi untuk menyimpan data transkrip ke local storage
const saveTranscriptToStorage = async (nim: string, allSemesterData: SemesterData[]) => {
  try {
    const storageKey = `${TRANSCRIPT_STORAGE_KEY}_${nim}`;
    await AsyncStorage.setItem(storageKey, JSON.stringify(allSemesterData));
    console.log(`Data transkrip untuk NIM ${nim} berhasil disimpan ke local storage`);
  } catch (error) {
    console.error('Error menyimpan data transkrip ke local storage:', error);
  }
};

// Fungsi untuk mengambil data transkrip dari local storage
const getTranscriptFromStorage = async (nim: string): Promise<SemesterData[] | null> => {
  try {
    const storageKey = `${TRANSCRIPT_STORAGE_KEY}_${nim}`;
    const storedData = await AsyncStorage.getItem(storageKey);
    
    if (storedData) {
      console.log(`Data transkrip untuk NIM ${nim} berhasil diambil dari local storage`);
      return JSON.parse(storedData);
    }
    
    console.log(`Tidak ada data transkrip tersimpan untuk NIM ${nim}`);
    return null;
  } catch (error) {
    console.error('Error mengambil data transkrip dari local storage:', error);
    return null;
  }
};

export default function TranskripPage() {
  const router = useRouter();
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [allSemesterData, setAllSemesterData] = useState<SemesterData[]>([]);
  const [currentSemester, setCurrentSemester] = useState(5); // Default semester 5
  const [activeTab, setActiveTab] = useState<'single' | 'all'>('single'); // 'single' untuk per semester, 'all' untuk semua
  const [isLoading, setIsLoading] = useState(true);
  
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Data default untuk field yang tidak ada di database
  const defaultUserData = {
    fullName: 'Mon. Abdul Aziz',
    nim: '232505059',
    email: '',
    prodi: 'S1 - Sistem Informasi',
    fakultas: 'Fakultas Komputer',
    jenisKelas: 'Reguler',
    alamat: '',
    avatar: 'https://cdn-icons-png.flaticon.com/512/1077/1077012.png'
  };

  useEffect(() => {
    fetchUserData();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    if (userData?.prodi && userData?.nim) {
      loadTranscriptData(userData.prodi, userData.nim);
    }
  }, [userData]);

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

  // Fungsi untuk memuat data transkrip semua semester
  const loadTranscriptData = async (prodi: string, nim: string) => {
    try {
      setIsLoading(true);
      
      // SPECIAL CASE: Untuk NIM 232505059, selalu generate data baru dengan IPK 3.99
      if (nim === '232505059') {
        console.log('Special case: Generating perfect transcript for NIM 232505059');
        const perfectData = getAllSemesterData(prodi, nim);
        setAllSemesterData(perfectData);
        await saveTranscriptToStorage(nim, perfectData);
        return;
      }
      
      // Coba ambil data dari local storage terlebih dahulu
      const storedData = await getTranscriptFromStorage(nim);
      
      if (storedData && storedData.length > 0) {
        console.log('Menggunakan data transkrip dari local storage');
        setAllSemesterData(storedData);
      } else {
        // Jika tidak ada data di local storage, generate data baru
        console.log('Generate data transkrip baru');
        const newData = getAllSemesterData(prodi, nim);
        setAllSemesterData(newData);
        await saveTranscriptToStorage(nim, newData);
      }
    } catch (error) {
      console.error('Error loading transcript data:', error);
      const fallbackData = getAllSemesterData(prodi, nim);
      setAllSemesterData(fallbackData);
    } finally {
      setIsLoading(false);
    }
  };

  // Hitung IPK kumulatif dari semua semester
  const calculateIPK = (): { ipk: string; totalSKS: number; totalNilaiMutu: number } => {
    if (!allSemesterData || allSemesterData.length === 0) {
      return { ipk: '0.00', totalSKS: 0, totalNilaiMutu: 0 };
    }

    const totalSKS = allSemesterData.reduce((sum, sem) => sum + sem.sks, 0);
    const totalNilaiMutu = allSemesterData.reduce((sum, sem) => sum + sem.totalNilaiMutu, 0);
    
    // SPECIAL CASE: Untuk NIM 232505059, set IPK menjadi 3.99
    const ipkValue = userData?.nim === '232505059' ? 3.99 : totalNilaiMutu / totalSKS;
    
    return {
      ipk: ipkValue.toFixed(2),
      totalSKS,
      totalNilaiMutu: Number(totalNilaiMutu.toFixed(2))
    };
  };

  const { ipk, totalSKS, totalNilaiMutu } = calculateIPK();
  const currentSemesterData = allSemesterData.find(sem => sem.semester === currentSemester);
  const transcriptData = currentSemesterData?.transcript || [];

  // Persist all semester data whenever it changes for the current user
  useEffect(() => {
    const persist = async () => {
      try {
        if (userData?.nim && allSemesterData && allSemesterData.length > 0) {
          await saveTranscriptToStorage(userData.nim, allSemesterData);
        }
      } catch (error) {
        console.error('Error auto-saving all semester data:', error);
      }
    };

    persist();
  }, [allSemesterData, userData?.nim]);

  // Komponen Tab untuk memilih tampilan
  const SemesterTabs = () => (
    <View style={styles.tabContainer}>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'single' && styles.activeTab]}
        onPress={() => setActiveTab('single')}
      >
        <Text style={[styles.tabText, activeTab === 'single' && styles.activeTabText]}>
          Per Semester
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.tab, activeTab === 'all' && styles.activeTab]}
        onPress={() => setActiveTab('all')}
      >
        <Text style={[styles.tabText, activeTab === 'all' && styles.activeTabText]}>
          Semua Semester
        </Text>
      </TouchableOpacity>
    </View>
  );

  // Komponen Filter Semester
  const SemesterFilter = () => (
    <View style={styles.semesterFilter}>
      <Text style={styles.filterLabel}>Pilih Semester:</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
        {[1, 2, 3, 4, 5].map((sem) => (
          <TouchableOpacity
            key={sem}
            style={[
              styles.semesterButton,
              currentSemester === sem && styles.activeSemesterButton
            ]}
            onPress={() => setCurrentSemester(sem)}
          >
            <Text style={[
              styles.semesterButtonText,
              currentSemester === sem && styles.activeSemesterButtonText
            ]}>
              Semester {sem}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  // Komponen Grafik Batang untuk IP Semester
  const IPSemesterChart = () => {
    const maxIP = 4.0;
    const chartHeight = 120;
    
    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>IP per Semester</Text>
        <View style={styles.chart}>
          {allSemesterData.map((semester) => (
            <View key={semester.semester} style={styles.barContainer}>
              <TouchableOpacity 
                style={styles.barWrapper}
                onPress={() => {
                  setCurrentSemester(semester.semester);
                  setActiveTab('single');
                }}
              >
                <View style={styles.barBackground}>
                  <View 
                    style={[
                      styles.bar,
                      { 
                        height: (semester.ip / maxIP) * chartHeight,
                        backgroundColor: semester.semester === currentSemester ? '#2196F3' : '#4CAF50'
                      }
                    ]} 
                  />
                </View>
                <Text style={styles.barLabel}>S{semester.semester}</Text>
                <Text style={styles.barValue}>{semester.ip.toFixed(2)}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Komponen Statistik Semester
  const SemesterStats = () => {
    if (!currentSemesterData) return null;

    return (
      <View style={styles.semesterStats}>
        <View style={styles.semesterStatCard}>
          <Ionicons name="school" size={24} color="#2196F3" />
          <Text style={styles.semesterStatValue}>{currentSemesterData.ip.toFixed(2)}</Text>
          <Text style={styles.semesterStatLabel}>IP Semester</Text>
        </View>
        <View style={styles.semesterStatCard}>
          <Ionicons name="library" size={24} color="#4CAF50" />
          <Text style={styles.semesterStatValue}>{currentSemesterData.sks}</Text>
          <Text style={styles.semesterStatLabel}>SKS</Text>
        </View>
        <View style={styles.semesterStatCard}>
          <Ionicons name="calculator" size={24} color="#FF9800" />
          <Text style={styles.semesterStatValue}>{currentSemesterData.totalNilaiMutu.toFixed(1)}</Text>
          <Text style={styles.semesterStatLabel}>Nilai Mutu</Text>
        </View>
      </View>
    );
  };

  // Komponen Tabel untuk Satu Semester
  const SingleSemesterTable = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>
          Transkrip Nilai Semester {currentSemester}
        </Text>
        <View style={styles.courseCount}>
          <Text style={styles.courseCountText}>
            Total: {transcriptData.length} mata kuliah
          </Text>
        </View>
      </View>
      
      <View style={styles.tableWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.tableContainer}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <View style={[styles.headerCell, styles.cellNo]}>
                <Text style={styles.headerCellText}>No</Text>
              </View>
              <View style={[styles.headerCell, styles.cellMataKuliah]}>
                <Text style={styles.headerCellText}>Mata Kuliah</Text>
              </View>
              <View style={[styles.headerCell, styles.cellKode]}>
                <Text style={styles.headerCellText}>Kode MK</Text>
              </View>
              <View style={[styles.headerCell, styles.cellHuruf]}>
                <Text style={styles.headerCellText}>Huruf Mutu</Text>
              </View>
              <View style={[styles.headerCell, styles.cellAngka]}>
                <Text style={styles.headerCellText}>Angka Mutu</Text>
              </View>
              <View style={[styles.headerCell, styles.cellSKS]}>
                <Text style={styles.headerCellText}>SKS</Text>
              </View>
              <View style={[styles.headerCell, styles.cellNilai]}>
                <Text style={styles.headerCellText}>Nilai Mutu</Text>
              </View>
            </View>

            {/* Table Rows */}
            {transcriptData && transcriptData.length > 0 ? (
              transcriptData.map((item, index) => (
                <View 
                  key={item.no} 
                  style={[
                    styles.tableRow,
                    index % 2 === 0 ? styles.rowEven : styles.rowOdd
                  ]}
                >
                  <View style={[styles.cell, styles.cellNo]}>
                    <Text style={styles.cellText}>{item.no}</Text>
                  </View>
                  <View style={[styles.cell, styles.cellMataKuliah]}>
                    <Text style={[styles.cellText, styles.mataKuliahText]} numberOfLines={2}>
                      {item.mataKuliah}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.cellKode]}>
                    <Text style={styles.cellText}>{item.kodeMK}</Text>
                  </View>
                  <View style={[styles.cell, styles.cellHuruf]}>
                    <View 
                      style={[
                        styles.gradeBadge,
                        { backgroundColor: getGradeColor(item.hurufMutu) }
                      ]}
                    >
                      <Text style={styles.gradeText}>{item.hurufMutu || '-'}</Text>
                    </View>
                  </View>
                  <View style={[styles.cell, styles.cellAngka]}>
                    <Text style={styles.cellText}>
                      {item.angkaMutu ? item.angkaMutu.toFixed(1) : '-'}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.cellSKS]}>
                    <Text style={styles.cellText}>{item.sks}</Text>
                  </View>
                  <View style={[styles.cell, styles.cellNilai]}>
                    <Text style={styles.cellText}>
                      {item.nilaiMutu ? item.nilaiMutu.toFixed(1) : '-'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noDataRow}>
                <Text style={styles.noDataText}>
                  {isLoading ? 'Memuat data...' : 'Data transkrip tidak tersedia'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );

  // Komponen Tabel untuk Semua Semester
  const AllSemestersTable = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Semua Mata Kuliah (Semester 1-5)</Text>
        <View style={styles.courseCount}>
          <Text style={styles.courseCountText}>
            Total: {allSemesterData.reduce((sum, sem) => sum + (sem.transcript?.length || 0), 0)} mata kuliah
          </Text>
        </View>
      </View>

      <View style={styles.tableWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={[styles.tableContainer, { minWidth: Platform.OS === 'web' ? 1100 : 1000 }]}>
            {/* Header */}
            <View style={styles.tableHeader}>
              <View style={[styles.headerCell, styles.cellSemester]}>
                <Text style={styles.headerCellText}>Semester</Text>
              </View>
              <View style={[styles.headerCell, styles.cellNo]}>
                <Text style={styles.headerCellText}>No</Text>
              </View>
              <View style={[styles.headerCell, styles.cellMataKuliah]}>
                <Text style={styles.headerCellText}>Mata Kuliah</Text>
              </View>
              <View style={[styles.headerCell, styles.cellKode]}>
                <Text style={styles.headerCellText}>Kode MK</Text>
              </View>
              <View style={[styles.headerCell, styles.cellHuruf]}>
                <Text style={styles.headerCellText}>Huruf</Text>
              </View>
              <View style={[styles.headerCell, styles.cellAngka]}>
                <Text style={styles.headerCellText}>Angka</Text>
              </View>
              <View style={[styles.headerCell, styles.cellSKS]}>
                <Text style={styles.headerCellText}>SKS</Text>
              </View>
              <View style={[styles.headerCell, styles.cellNilai]}>
                <Text style={styles.headerCellText}>Nilai Mutu</Text>
              </View>
            </View>

            {/* Rows: gabungkan semua semester */}
            {allSemesterData && allSemesterData.length > 0 ? (
              allSemesterData.flatMap((sem) => 
                sem.transcript.map(item => ({ semester: sem.semester, ...item }))
              ).map((row, index) => (
                <View 
                  key={`${row.semester}-${row.no}`} 
                  style={[
                    styles.tableRow, 
                    index % 2 === 0 ? styles.rowEven : styles.rowOdd
                  ]}
                >
                  <View style={[styles.cell, styles.cellSemester]}>
                    <Text style={styles.cellText}>S{row.semester}</Text>
                  </View>
                  <View style={[styles.cell, styles.cellNo]}>
                    <Text style={styles.cellText}>{row.no}</Text>
                  </View>
                  <View style={[styles.cell, styles.cellMataKuliah]}>
                    <Text style={[styles.cellText, styles.mataKuliahText]} numberOfLines={2}>
                      {row.mataKuliah}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.cellKode]}>
                    <Text style={styles.cellText}>{row.kodeMK}</Text>
                  </View>
                  <View style={[styles.cell, styles.cellHuruf]}>
                    <View style={[
                      styles.gradeBadge, 
                      { backgroundColor: getGradeColor(row.hurufMutu) }
                    ]}>
                      <Text style={styles.gradeText}>{row.hurufMutu || '-'}</Text>
                    </View>
                  </View>
                  <View style={[styles.cell, styles.cellAngka]}>
                    <Text style={styles.cellText}>
                      {row.angkaMutu ? row.angkaMutu.toFixed(1) : '-'}
                    </Text>
                  </View>
                  <View style={[styles.cell, styles.cellSKS]}>
                    <Text style={styles.cellText}>{row.sks}</Text>
                  </View>
                  <View style={[styles.cell, styles.cellNilai]}>
                    <Text style={styles.cellText}>
                      {row.nilaiMutu ? row.nilaiMutu.toFixed(1) : '-'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.noDataRow}>
                <Text style={styles.noDataText}>
                  {isLoading ? 'Memuat data...' : 'Data transkrip tidak tersedia'}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </View>
  );

  // Fungsi lainnya tetap sama...
  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.log('No user logged in');
        const userData = defaultUserData;
        setUserData(userData);
        await loadTranscriptData(userData.prodi, userData.nim);
        return;
      }

      const usersRef = collection(database, 'users');
      const q = query(usersRef, where('email', '==', currentUser.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];
        const userDataFromDB = userDoc.data();
        
        const userData = {
          uid: userDoc.id,
          fullName: userDataFromDB.fullName || defaultUserData.fullName,
          nim: userDataFromDB.nim || defaultUserData.nim,
          email: userDataFromDB.email || currentUser.email || '',
          prodi: userDataFromDB.prodi || defaultUserData.prodi,
          fakultas: 'Fakultas Komputer',
          jenisKelas: userDataFromDB.jenisKelas || defaultUserData.jenisKelas,
          alamat: userDataFromDB.alamat || '',
          avatar: userDataFromDB.avatar || defaultUserData.avatar
        };

        setUserData(userData);
        await loadTranscriptData(userData.prodi, userData.nim);
      } else {
        const userData = {
          ...defaultUserData,
          email: currentUser.email || '',
          fakultas: 'Fakultas Komputer'
        };
        setUserData(userData);
        await loadTranscriptData(userData.prodi, userData.nim);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      const userData = {
        ...defaultUserData,
        email: auth.currentUser?.email || '',
        fakultas: 'Fakultas Komputer'
      };
      setUserData(userData);
      await loadTranscriptData(userData.prodi, userData.nim);
    }
  };

  const handleRefreshTranscript = async () => {
    if (!userData?.prodi || !userData?.nim) return;
    
    try {
      setIsLoading(true);
      console.log('Merefresh data transkrip...');
      
      const newData = getAllSemesterData(userData.prodi, userData.nim);
      setAllSemesterData(newData);
      await saveTranscriptToStorage(userData.nim, newData);
      
      console.log('Data transkrip berhasil di-refresh dan disimpan');
    } catch (error) {
      console.error('Error refreshing transcript:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const menuItems: { title: string; icon: ComponentProps<typeof Ionicons>['name']; onPress: () => void }[] = [
    { 
      title: 'Dashboard', 
      icon: 'home',
      onPress: () => {
        closeMenu();
        setTimeout(() => router.push('/(tabs)/dashboard'), 300);
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

  const displayData = (data: string | undefined | null, fallback = '-'): string => {
    return data && data !== '' && data !== '-' ? data : fallback;
  };

  const currentData = userData || defaultUserData;

  const getGradeColor = (grade: string): string => {
    switch (grade) {
      case 'A': return '#4CAF50';
      case 'A-': return '#8BC34A';
      case 'B+': return '#CDDC39';
      case 'B': return '#FFEB3B';
      case 'B-': return '#FFC107';
      case 'C+': return '#FF9800';
      case 'C': return '#FF5722';
      case 'D': return '#F44336';
      case 'E': return '#D32F2F';
      case 'T': return '#9E9E9E';
      default: return '#757575';
    }
  };

  const isCumlaude = parseFloat(ipk) >= 3.5;

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
        <Text style={styles.headerTitle}>Transkrip Nilai</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={handleRefreshTranscript}
            disabled={isLoading}
          >
            <Ionicons 
              name="refresh" 
              size={20} 
              color={isLoading ? '#999' : '#2196F3'} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView 
        style={[styles.container, { opacity: fadeAnim }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Loading Indicator */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <Text style={styles.loadingText}>Memuat data transkrip...</Text>
          </View>
        )}

        {/* Info Header */}
        <Animated.View 
          style={[
            styles.infoHeader,
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
          <View style={styles.studentInfo}>
            <Text style={styles.studentName}>
              {displayData(currentData.fullName)}
            </Text>
            <Text style={styles.studentNim}>
              NIM: {displayData(currentData.nim)}
            </Text>
            <Text style={styles.studentProdi}>
              {displayData(currentData.prodi)}
            </Text>
            <Text style={styles.studentFakultas}>
              {displayData(currentData.fakultas)}
            </Text>
          </View>
          <View style={styles.semesterInfo}>
            <Text style={styles.semesterTitle}>IPK Kumulatif</Text>
            <Text style={styles.semesterValue}>{ipk}</Text>
            <Text style={styles.statusAktif}>Total SKS: {totalSKS}</Text>
            <Text style={styles.storageInfo}>
              {allSemesterData.length > 0 ? '✓ Data tersimpan lokal' : ''}
              {currentData.nim === '232505059' && ' • IPK Sempurna'}
            </Text>
          </View>
        </Animated.View>

        {/* Grafik IP Semester */}
        <IPSemesterChart />

        {/* Statistik IPK */}
        <Animated.View 
          style={[
            styles.statsContainer,
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
          <View style={styles.statCard}>
            <Ionicons name="school" size={32} color="#2196F3" />
            <Text style={styles.statValue}>{ipk}</Text>
            <Text style={styles.statLabel}>IPK Kumulatif</Text>
            {currentData.nim === '232505059' && (
              <View style={styles.perfectBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.perfectBadgeText}>Sempurna</Text>
              </View>
            )}
          </View>
          <View style={styles.statCard}>
            <Ionicons name="library" size={32} color="#4CAF50" />
            <Text style={styles.statValue}>{totalSKS}</Text>
            <Text style={styles.statLabel}>Total SKS</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="calculator" size={32} color="#FF9800" />
            <Text style={styles.statValue}>{totalNilaiMutu}</Text>
            <Text style={styles.statLabel}>Total Nilai</Text>
          </View>
        </Animated.View>

        {/* Tab untuk memilih tampilan */}
        <SemesterTabs />

        {/* Filter Semester (hanya tampil saat mode single) */}
        {activeTab === 'single' && <SemesterFilter />}

        {/* Statistik Semester yang Dipilih (hanya tampil saat mode single) */}
        {activeTab === 'single' && <SemesterStats />}

        {/* Pesan Cumlaude jika IPK >= 3.5 */}
        {isCumlaude && (
          <Animated.View 
            style={[
              styles.cumlaudeCard,
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
            <View style={styles.cumlaudeHeader}>
              <Ionicons name="trophy" size={24} color="#FFD700" />
              <Text style={styles.cumlaudeTitle}>
                {currentData.nim === '232505059' ? 'IPK Sempurna! Outstanding!' : 'Selamat! Kamu Cumlaude'}
              </Text>
              <Ionicons name="trophy" size={24} color="#FFD700" />
            </View>
            <Text style={styles.cumlaudeMessage}>
              {currentData.nim === '232505059' 
                ? 'Prestasi akademik yang luar biasa! Pertahankan nilai sempurna ini!' 
                : 'Pertahankanlah prestasi akademik yang luar biasa ini!'}
            </Text>
          </Animated.View>
        )}

        {/* Tabel Transkrip berdasarkan tab aktif */}
        {activeTab === 'single' ? <SingleSemesterTable /> : <AllSemestersTable />}
        
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
          <Image 
            source={{ uri: currentData.avatar ?? 'https://cdn-icons-png.flaticon.com/512/1077/1077012.png' }} 
            style={styles.sidebarAvatar} 
            defaultSource={{ uri: 'https://cdn-icons-png.flaticon.com/512/1077/1077012.png' }}
          />
          <View style={styles.sidebarUserInfo}>
            <Text style={styles.sidebarName}>
              {displayData(currentData.fullName)}
            </Text>
            <Text style={styles.sidebarNim}>
              {displayData(currentData.nim)}
            </Text>
            <Text style={styles.sidebarProdi}>
              {displayData(currentData.prodi)}
            </Text>
            {currentData.nim === '232505059' && (
              <View style={styles.sidebarBadge}>
                <Ionicons name="star" size={12} color="#FFD700" />
                <Text style={styles.sidebarBadgeText}>IPK Sempurna</Text>
              </View>
            )}
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
            onPress={async () => {
              try {
                setIsMenuVisible(false);
                await signOut(auth);
                router.replace('/(tabs)');
              } catch (error) {
                console.error('Logout error:', error);
              }
            }}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  refreshButton: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: Platform.OS === 'web' ? 24 : 16,
    paddingBottom: 30,
    maxWidth: Platform.OS === 'web' ? 1200 : '100%',
    alignSelf: Platform.OS === 'web' ? 'center' : 'stretch',
    width: Platform.OS === 'web' ? '95%' : '100%',
  },
  // Tab Styles
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#2196F3',
  },
  tabText: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  // Semester Filter Styles
  semesterFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterLabel: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 12,
  },
  filterScroll: {
    flex: 1,
  },
  semesterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  activeSemesterButton: {
    backgroundColor: '#2196F3',
  },
  semesterButtonText: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    fontWeight: '500',
    color: '#666',
  },
  activeSemesterButtonText: {
    color: '#fff',
  },
  // Loading Styles
  loadingContainer: {
    backgroundColor: '#e3f2fd',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  loadingText: {
    color: '#1976D2',
    fontSize: 14,
    fontWeight: '500',
  },
  // Info Header Styles
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  studentInfo: {
    flex: 2,
  },
  studentName: {
    fontSize: Platform.OS === 'web' ? 24 : 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  studentNim: {
    fontSize: Platform.OS === 'web' ? 18 : 16,
    color: '#666',
    marginBottom: 2,
  },
  studentProdi: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#2196F3',
    marginBottom: 2,
    fontWeight: '600',
  },
  studentFakultas: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#666',
  },
  semesterInfo: {
    flex: 1,
    alignItems: 'flex-end',
  },
  semesterTitle: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#666',
    marginBottom: 4,
  },
  semesterValue: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    fontWeight: 'bold',
    color: '#2196F3',
    marginBottom: 4,
  },
  statusAktif: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#4CAF50',
    fontWeight: '600',
    marginBottom: 2,
  },
  storageInfo: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    color: '#666',
    fontStyle: 'italic',
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
  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: Platform.OS === 'web' ? 20 : 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    position: 'relative',
  },
  statValue: {
    fontSize: Platform.OS === 'web' ? 28 : 24,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#666',
    textAlign: 'center',
  },
  perfectBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  perfectBadgeText: {
    fontSize: 8,
    color: '#FF8F00',
    fontWeight: 'bold',
    marginLeft: 2,
  },
  // Semester Stats
  semesterStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  semesterStatCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: Platform.OS === 'web' ? 16 : 12,
    borderRadius: 8,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  semesterStatValue: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    fontWeight: 'bold',
    color: '#333',
    marginVertical: 4,
  },
  semesterStatLabel: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    color: '#666',
    textAlign: 'center',
  },
  // Cumlaude Card
  cumlaudeCard: {
    backgroundColor: '#FFF8E1',
    padding: Platform.OS === 'web' ? 20 : 16,
    borderRadius: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#FFD700',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cumlaudeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  cumlaudeTitle: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    fontWeight: 'bold',
    color: '#FF6F00',
    marginHorizontal: 8,
    textAlign: 'center',
  },
  cumlaudeMessage: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#FF8F00',
    textAlign: 'center',
    fontWeight: '500',
  },
  // Section Styles
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: Platform.OS === 'web' ? 20 : 18,
    fontWeight: 'bold',
    color: '#333',
    paddingLeft: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  sectionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  scrollHint: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  scrollHintText: {
    fontSize: Platform.OS === 'web' ? 12 : 10,
    color: '#666',
    marginLeft: 4,
  },
  // Table Styles
  tableWrapper: {
    backgroundColor: '#fff',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  horizontalScroll: {},
  tableContainer: {
    minWidth: Platform.OS === 'web' ? 900 : 800,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    borderBottomWidth: 1,
    borderBottomColor: '#1976D2',
  },
  headerCell: {
    paddingVertical: Platform.OS === 'web' ? 16 : 12,
    paddingHorizontal: Platform.OS === 'web' ? 12 : 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#1976D2',
  },
  headerCellText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: Platform.OS === 'web' ? 14 : 12,
    textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    minHeight: Platform.OS === 'web' ? 50 : 45,
  },
  rowEven: {
    backgroundColor: '#fff',
  },
  rowOdd: {
    backgroundColor: '#f8f9fa',
  },
  cell: {
    paddingVertical: Platform.OS === 'web' ? 12 : 10,
    paddingHorizontal: Platform.OS === 'web' ? 12 : 8,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f0f0f0',
  },
  cellText: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#333',
    textAlign: 'center',
  },
  mataKuliahText: {
    textAlign: 'left',
  },
  // Cell Widths
  cellSemester: {
    width: 80,
  },
  cellNo: {
    width: 50,
  },
  cellMataKuliah: {
    width: 280,
  },
  cellKode: {
    width: 100,
  },
  cellHuruf: {
    width: 90,
  },
  cellAngka: {
    width: 90,
  },
  cellSKS: {
    width: 60,
  },
  cellNilai: {
    width: 100,
    borderRightWidth: 0,
  },
  // Grade Badge
  gradeBadge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'center',
    minWidth: 50,
  },
  gradeText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: Platform.OS === 'web' ? 14 : 12,
    textAlign: 'center',
  },
  // No Data Row
  noDataRow: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noDataText: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#666',
    textAlign: 'center',
  },
  // Course Count
  courseCount: {
    alignItems: 'flex-end',
  },
  courseCountText: {
    fontSize: Platform.OS === 'web' ? 14 : 12,
    color: '#666',
    fontStyle: 'italic',
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
  sidebarBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFD700',
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  sidebarBadgeText: {
    fontSize: 10,
    color: '#FFD700',
    fontWeight: 'bold',
    marginLeft: 2,
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
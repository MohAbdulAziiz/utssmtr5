import { View, Text, TouchableOpacity, StyleSheet, Image, ScrollView, SafeAreaView, Animated, Dimensions, StatusBar, Alert, TextInput, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import React, { useState, useRef, useEffect } from 'react';
import { signOut } from 'firebase/auth';
import { auth, database } from '../../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import * as ImagePicker from 'expo-image-picker';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Data program studi
const PROGRAM_STUDI = {
  'S1': [
    'S1 - Sistem Informasi',
    'S1 - Bisnis Digital'
  ],
  'D3': [
    'D3 - Komputerisasi Akuntansi'
  ]
};

// Tipe data user untuk TypeScript
interface UserData {
  uid?: string;
  fullName: string;
  nim: string;
  email: string;
  prodi: string;
  fakultas: string;
  jenisKelas: string;
  alamat: string;
  avatar: string;
}

export default function ProfilePage() {
  const router = useRouter();
  // Data default untuk field yang tidak ada di database
  const defaultUserData: UserData = {
    fullName: 'Mon. Abdul Aziz',
    nim: '232505059',
    email: '',
    prodi: 'S1 - Sistem Informasi',
    fakultas: 'Fakultas Komputer',
    jenisKelas: 'Reguler',
    alamat: '',
    avatar: 'https://cdn-icons-png.flaticon.com/512/1077/1077012.png'
  };
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<UserData>(defaultUserData);
  const [showProdiDropdown, setShowProdiDropdown] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(-SCREEN_WIDTH * 0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const prodiDropdownAnim = useRef(new Animated.Value(0)).current;
  const [showJenisDropdown, setShowJenisDropdown] = useState(false);
  const jenisDropdownAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Ambil data user dari Firestore
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

  useEffect(() => {
    // Animasi dropdown program studi
    Animated.timing(prodiDropdownAnim, {
      toValue: showProdiDropdown ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  
    // Animasi dropdown jenis kelas
    Animated.timing(jenisDropdownAnim, {
      toValue: showJenisDropdown ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showProdiDropdown, showJenisDropdown]);

  const fetchUserData = async () => {
    try {
      const currentUser = auth.currentUser;
      
      if (!currentUser) {
        console.log('No user logged in');
        setUserData(defaultUserData);
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
        
        // Gabungkan data dari database dengan data default
        setUserData({
          uid: userDoc.id,
          fullName: userDataFromDB.fullName || defaultUserData.fullName,
          nim: userDataFromDB.nim || defaultUserData.nim,
          email: userDataFromDB.email || currentUser.email || '',
          prodi: userDataFromDB.prodi || defaultUserData.prodi,
          fakultas: 'Fakultas Komputer', // Selalu Fakultas Komputer
          jenisKelas: userDataFromDB.jenisKelas || defaultUserData.jenisKelas,
          alamat: userDataFromDB.alamat || '',
          avatar: userDataFromDB.avatar || defaultUserData.avatar
        });
      } else {
        console.log('User tidak ditemukan di database, menggunakan data default');
        setUserData({
          ...defaultUserData,
          email: currentUser.email || '',
          fakultas: 'Fakultas Komputer' // Selalu Fakultas Komputer
        });
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
      // Fallback data jika error
      setUserData({
        ...defaultUserData,
        email: auth.currentUser?.email || '',
        fakultas: 'Fakultas Komputer' // Selalu Fakultas Komputer
      });
    }
  };

  const handleEdit = () => {
    setEditData(userData || defaultUserData);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditData(defaultUserData);
    setShowProdiDropdown(false);
    setShowJenisDropdown(false);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const currentUser = auth.currentUser;
      if (!currentUser) {
        Alert.alert('Error', 'User tidak terautentikasi');
        return;
      }

      // Cari user document
      const usersRef = collection(database, 'users');
      const q = query(usersRef, where('email', '==', currentUser.email));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const userDoc = querySnapshot.docs[0];

        // Update data di Firestore (prodi tidak dapat diubah dari sini)
        await updateDoc(doc(database, 'users', userDoc.id), {
          fullName: editData.fullName,
          fakultas: 'Fakultas Komputer', // Selalu Fakultas Komputer
          jenisKelas: editData.jenisKelas,
          alamat: editData.alamat,
          avatar: editData.avatar,
          email: editData.email,
          updatedAt: new Date()
        });

        // Update state lokal
        setUserData(editData);
        setIsEditing(false);
  setShowProdiDropdown(false);
  setShowJenisDropdown(false);

        Alert.alert('Sukses', 'Data berhasil diperbarui');
      } else {
        Alert.alert('Error', 'User tidak ditemukan di database');
      }
    } catch (error) {
      console.error('Error updating user data:', error);
      Alert.alert('Error', 'Gagal memperbarui data');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Izin diperlukan', 'Izin akses galeri diperlukan untuk mengubah foto profil');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled) {
        setEditData({
          ...editData,
          avatar: result.assets[0].uri
        });
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Gagal memilih gambar');
    }
  };

  const handleSelectProdi = (prodi: string) => {
    setEditData({
      ...editData,
      prodi: prodi
    });
    setShowProdiDropdown(false);
  };

  const handleLogout = async () => {
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
      
      setIsMenuVisible(false);
      router.replace('/(tabs)/login');
      
    } catch (error) {
      console.error("Logout error:", error);
      
      if (Platform.OS === 'web') {
        alert('Terjadi kesalahan saat logout. Silakan coba lagi.');
      } else {
        Alert.alert('Error', 'Terjadi kesalahan saat logout. Silakan coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  };

  const menuItems: { title: string; icon: React.ComponentProps<typeof Ionicons>['name']; onPress: () => void }[] = [
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
      icon: 'person', // Diubah dari 'user' menjadi 'person' untuk konsistensi
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

  // Fungsi untuk menampilkan data atau strip jika kosong
  const displayData = (data: string | undefined | null, fallback = '-'): string => {
    return data && data !== '' && data !== '-' ? data : fallback;
  };

  // Animasi untuk dropdown
  const prodiDropdownOpacity = prodiDropdownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1]
  });

  const prodiDropdownTranslateY = prodiDropdownAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-10, 0]
  });

  // Tampilkan data default jika userData belum dimuat
  const currentData = userData || defaultUserData;

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
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.placeholder} />
      </View>

      <Animated.ScrollView 
        style={[styles.container, { opacity: fadeAnim }]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Profile dengan Foto */}
        <Animated.View 
          style={[
            styles.profileHeader,
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
          <View style={styles.avatarContainer}>
            <Image 
              source={{ uri: isEditing ? editData.avatar : currentData.avatar }} 
              style={styles.avatar} 
              defaultSource={{ uri: 'https://cdn-icons-png.flaticon.com/512/1077/1077012.png' }}
            />
            {isEditing && (
              <TouchableOpacity 
                style={styles.editPhotoButton}
                onPress={handleImagePick}
              >
                <Ionicons name="camera" size={20} color="#fff" />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.name}>
              {isEditing ? editData.fullName : displayData(currentData.fullName)}
            </Text>
            <Text style={styles.nim}>
              NIM: {displayData(currentData.nim)}
            </Text>
            <Text style={styles.email}>
              {displayData(currentData.email)}
            </Text>
          </View>
        </Animated.View>

        {/* Action Button */}
        {!isEditing ? (
          <Animated.View 
            style={[
              styles.actionContainer,
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
            <TouchableOpacity 
              style={styles.editButton}
              onPress={handleEdit}
            >
              <Ionicons name="create-outline" size={20} color="#fff" />
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          </Animated.View>
        ) : (
          <Animated.View 
            style={[
              styles.editActionsContainer,
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
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelEdit}
            >
              <Text style={styles.cancelButtonText}>Batal</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.saveButton}
              onPress={handleSave}
              disabled={loading}
            >
              <Text style={styles.saveButtonText}>
                {loading ? 'Menyimpan...' : 'Simpan'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        )}

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
            {/* Nama */}
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Nama Lengkap</Text>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={editData.fullName}
                  onChangeText={(text) => setEditData({...editData, fullName: text})}
                  placeholder="Masukkan nama lengkap"
                />
              ) : (
                <Text style={styles.tableData}>
                  {displayData(currentData.fullName)}
                </Text>
              )}
            </View>

            {/* NIM */}
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>NIM</Text>
              <Text style={[styles.tableData, styles.disabledField]}>
                {displayData(currentData.nim)}
              </Text>
            </View>

            {/* Email */}
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Email</Text>
              {isEditing ? (
                <TextInput
                  style={styles.textInput}
                  value={editData.email}
                  onChangeText={(text) => setEditData({ ...editData, email: text })}
                  placeholder="Masukkan email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              ) : (
                <Text style={[styles.tableData, styles.disabledField]}>
                  {displayData(currentData.email)}
                </Text>
              )}
            </View>

            {/* Prodi (read-only) */}
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Program Studi</Text>
              <Text style={styles.tableData}>
                {displayData(currentData.prodi)}
              </Text>
            </View>

            {/* Fakultas */}
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Fakultas</Text>
              <Text style={[styles.tableData, styles.disabledField]}>
                Fakultas Komputer
              </Text>
            </View>

            {/* Jenis Kelas */}
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Jenis Kelas</Text>
              {isEditing ? (
                <View style={styles.prodiContainer}>
                  <TouchableOpacity
                    style={styles.prodiSelector}
                    onPress={() => setShowJenisDropdown(!showJenisDropdown)}
                  >
                    <Text style={styles.prodiSelectorText}>
                      {editData.jenisKelas || 'Pilih Jenis Kelas'}
                    </Text>
                    <Ionicons
                      name={showJenisDropdown ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color="#666"
                    />
                  </TouchableOpacity>

                  {showJenisDropdown && (
                    <Animated.View
                      style={[
                        styles.prodiDropdown,
                        {
                          opacity: jenisDropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }),
                          transform: [{ translateY: jenisDropdownAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) }]
                        }
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.prodiDropdownItem}
                        onPress={() => { setEditData({ ...editData, jenisKelas: 'Reguler' }); setShowJenisDropdown(false); }}
                      >
                        <Text style={styles.prodiDropdownItemText}>Reguler</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.prodiDropdownItem}
                        onPress={() => { setEditData({ ...editData, jenisKelas: 'Non_Reguler' }); setShowJenisDropdown(false); }}
                      >
                        <Text style={styles.prodiDropdownItemText}>Non-Reguler</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  )}
                </View>
              ) : (
                <Text style={styles.tableData}>
                  {displayData(currentData.jenisKelas)}
                </Text>
              )}
            </View>

            {/* Alamat */}
            <View style={styles.tableRow}>
              <Text style={styles.tableHeader}>Alamat</Text>
              {isEditing ? (
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={editData.alamat}
                  onChangeText={(text) => setEditData({...editData, alamat: text})}
                  placeholder="Masukkan alamat"
                  multiline
                  numberOfLines={3}
                />
              ) : (
                <Text style={styles.tableData}>
                  {displayData(currentData.alamat, 'Belum diisi')}
                </Text>
              )}
            </View>
          </View>
        </Animated.View>

        {/* Informasi Akun */}
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
          <Text style={styles.sectionTitle}>Informasi Akun</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoItem}>
              <Ionicons name="time-outline" size={20} color="#666" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Terakhir Diperbarui</Text>
                <Text style={styles.infoValue}>{new Date().toLocaleDateString('id-ID')}</Text>
              </View>
            </View>
            <View style={styles.infoItem}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#666" />
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>Status Akun</Text>
                <Text style={styles.infoValue}>Aktif</Text>
              </View>
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
          <Image 
            source={{ uri: currentData.avatar }} 
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
    maxWidth: Platform.OS === 'web' ? 800 : '100%',
    alignSelf: Platform.OS === 'web' ? 'center' : 'stretch',
    width: Platform.OS === 'web' ? '90%' : '100%',
  },
  // Profile Header Styles
  profileHeader: {
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
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    width: Platform.OS === 'web' ? 100 : 80,
    height: Platform.OS === 'web' ? 100 : 80,
    borderRadius: Platform.OS === 'web' ? 50 : 40,
  },
  editPhotoButton: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#2196F3',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  profileInfo: {
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
    marginBottom: 2,
  },
  email: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#888',
  },
  // Action Buttons
  actionContainer: {
    marginBottom: 20,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    gap: 8,
  },
  editButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  editActionsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Section Styles
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
    alignItems: 'center',
    minHeight: 60,
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
  disabledField: {
    color: '#999',
    fontStyle: 'italic',
  },
  textInput: {
    flex: 2,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 10,
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#333',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Program Studi Styles
  prodiContainer: {
    flex: 2,
    position: 'relative',
  },
  prodiSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 6,
    padding: 10,
  },
  prodiSelectorText: {
    fontSize: Platform.OS === 'web' ? 16 : 14,
    color: '#333',
  },
  prodiDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    maxHeight: 200,
    zIndex: 1000,
  },
  prodiDropdownScroll: {
    maxHeight: 200,
  },
  prodiDropdownTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f7ff',
  },
  prodiDropdownItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  prodiDropdownItemText: {
    fontSize: 14,
    color: '#333',
  },
  // Info Card Styles
  infoCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: Platform.OS === 'web' ? 20 : 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoText: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
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
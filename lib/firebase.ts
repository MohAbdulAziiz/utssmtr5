// lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Pastikan config ini sama dengan yang ada di Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyDakdUoz2zCpil5DE-_g2SlhZgrVn02jvU",
  authDomain: "utssmtr5.firebaseapp.com",
  databaseURL: "https://utssmtr5-default-rtdb.firebaseio.com",
  projectId: "utssmtr5",
  storageBucket: "utssmtr5.firebasestorage.app",
  messagingSenderId: "901188371654",
  appId: "1:901188371654:web:374058e3c164b2f800c3c7",
  measurementId: "G-1W68VMLNFW"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const database = getFirestore(app);

export default app;
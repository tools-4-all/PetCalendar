// Configurazione Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBHF2Aed5gE_QUvqQy-psWuotLoYmL5gI4",
    authDomain: "petcalendar-67853.firebaseapp.com",
    projectId: "petcalendar-67853",
    storageBucket: "petcalendar-67853.firebasestorage.app",
    messagingSenderId: "453358757122",
    appId: "1:453358757122:web:181ac31c2bad4069c40e1b",
    measurementId: "G-SNVSZ65LBH"
};

// Inizializza Firebase
firebase.initializeApp(firebaseConfig);

// Inizializza servizi
const db = firebase.firestore();
const auth = firebase.auth();

// Helper per ottenere timestamp
const getTimestamp = () => firebase.firestore.Timestamp.now();

// Helper per convertire timestamp in Date
const timestampToDate = (timestamp) => {
    if (timestamp && timestamp.toDate) {
        return timestamp.toDate();
    }
    return new Date(timestamp);
};


// Esempio di configurazione Firebase
// Copia questo file come firebase-config.js e inserisci le tue credenziali

const firebaseConfig = {
    apiKey: "AIzaSyExample123456789",
    authDomain: "tuo-progetto.firebaseapp.com",
    projectId: "tuo-progetto",
    storageBucket: "tuo-progetto.appspot.com",
    messagingSenderId: "123456789012",
    appId: "1:123456789012:web:abcdef123456"
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


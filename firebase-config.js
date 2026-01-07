// Configurazione Firebase
// IMPORTANTE: Sostituisci questi valori con quelli del tuo progetto Firebase
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_STORAGE_BUCKET",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
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


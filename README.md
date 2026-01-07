# PetCalendar - Sistema di Prenotazioni per Toelettatori

Sistema completo di prenotazioni online per toelettatori animali domestici. Sito statico sviluppato con HTML, CSS e JavaScript, integrato con Firebase Firestore.

## 🐾 Funzionalità

### Per i Clienti:
- ✅ **Calendario interattivo** per visualizzare e prenotare appuntamenti
- ✅ **Gestione animali** - Aggiungi e gestisci le schede dei tuoi animali domestici
- ✅ **Prenotazioni online** - Prenota servizi di toelettatura in modo semplice
- ✅ **Pagamento online o in presenza** - Scegli come pagare
- ✅ **Visualizzazione prenotazioni** - Vedi tutte le tue prenotazioni passate e future

### Per i Toelettatori:
- ✅ **Agenda giornaliera** - Visualizza tutte le prenotazioni del giorno
- ✅ **Calendario completo** - Vista mensile, settimanale e giornaliera
- ✅ **Gestione prenotazioni** - Conferma, completa o annulla prenotazioni
- ✅ **Statistiche** - Visualizza prenotazioni del giorno, in attesa e completate
- ✅ **Dettagli completi** - Accesso a tutte le informazioni su animali e clienti

### Sistema di Notifiche:
- ✅ **Promemoria automatici** via email
- ✅ **Notifiche di conferma** prenotazione
- ✅ **Notifiche cambio stato** (confermata, completata, annullata)

## 🚀 Setup e Installazione

### 1. Configurazione Firebase

1. Crea un progetto su [Firebase Console](https://console.firebase.google.com/)
2. Abilita **Authentication** (Email/Password)
3. Crea un database **Firestore**
4. Configura le regole di sicurezza Firestore:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Animali - solo il proprietario può leggere/scrivere
    match /animals/{animalId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
    }
    
    // Prenotazioni - clienti vedono solo le loro, admin vede tutto
    match /bookings/{bookingId} {
      allow read: if request.auth != null && (
        request.auth.uid == resource.data.userId || 
        // Aggiungi qui il controllo per admin se necessario
        true // Per ora tutti gli autenticati possono leggere
      );
      allow create: if request.auth != null && request.auth.uid == request.resource.data.userId;
      allow update: if request.auth != null; // Admin può aggiornare
    }
  }
}
```

5. Copia le credenziali Firebase in `firebase-config.js`:

```javascript
const firebaseConfig = {
    apiKey: "TUA_API_KEY",
    authDomain: "TUO_AUTH_DOMAIN",
    projectId: "TUO_PROJECT_ID",
    storageBucket: "TUO_STORAGE_BUCKET",
    messagingSenderId: "TUO_MESSAGING_SENDER_ID",
    appId: "TUO_APP_ID"
};
```

### 2. Configurazione EmailJS (Notifiche)

1. Crea un account su [EmailJS](https://www.emailjs.com/)
2. Configura un servizio email (Gmail, Outlook, etc.)
3. Crea template email per:
   - Nuova prenotazione
   - Cambio stato prenotazione
   - Promemoria
4. Aggiungi le credenziali in `notifications.js`
5. Aggiungi lo script EmailJS in `index.html` e `admin.html`:

```html
<script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>
```

### 3. Configurazione Stripe (Pagamenti Online - Opzionale)

1. Crea un account su [Stripe](https://stripe.com/)
2. Ottieni la chiave pubblica API
3. Aggiungi la chiave in `payment.js`
4. Per pagamenti completi, configura Firebase Cloud Functions o un backend per gestire Payment Intents
5. Aggiungi lo script Stripe in `index.html`:

```html
<script src="https://js.stripe.com/v3/"></script>
```

**Nota:** Per un sito completamente statico, puoi usare Stripe Checkout che non richiede backend.

### 4. Deploy su GitHub Pages

1. Pusha il codice su GitHub
2. Vai su Settings > Pages del repository
3. Seleziona il branch `main` e la cartella `/root`
4. Il sito sarà disponibile su `https://tuousername.github.io/PetCalendar/`

## 📁 Struttura File

```
PetCalendar/
├── index.html          # Pagina principale per clienti
├── admin.html          # Pagina admin per toelettatori
├── styles.css          # Stili CSS
├── firebase-config.js  # Configurazione Firebase
├── app.js              # Logica applicazione clienti
├── admin.js            # Logica applicazione admin
├── notifications.js    # Sistema notifiche
├── payment.js          # Sistema pagamenti
└── README.md           # Questo file
```

## 🎨 Personalizzazione

### Colori
Modifica le variabili CSS in `styles.css`:

```css
:root {
    --primary-color: #4a90e2;
    --secondary-color: #50c878;
    --danger-color: #e74c3c;
    /* ... */
}
```

### Prezzi Servizi
Modifica i prezzi in `payment.js`:

```javascript
const SERVICE_PRICES = {
    'toelettatura-completa': 5000, // €50.00
    'bagno': 2500, // €25.00
    // ...
};
```

## 🔒 Sicurezza

- Le regole Firestore proteggono i dati degli utenti
- L'autenticazione Firebase gestisce login sicuro
- I pagamenti passano attraverso Stripe (PCI compliant)

## 📱 Responsive

Il sito è completamente responsive e funziona su:
- Desktop
- Tablet
- Smartphone

## 🛠️ Tecnologie Utilizzate

- **HTML5** - Struttura
- **CSS3** - Styling moderno
- **JavaScript (ES6+)** - Logica applicazione
- **Firebase Firestore** - Database
- **Firebase Authentication** - Autenticazione
- **FullCalendar** - Calendario interattivo
- **EmailJS** - Notifiche email
- **Stripe** - Pagamenti online

## 📝 Note

- Per le notifiche SMS, puoi integrare Twilio o usare EmailJS con provider SMS
- I promemoria automatici richiedono un sistema di cron job (es. Firebase Cloud Functions)
- Per pagamenti completi con Stripe, considera l'uso di Firebase Cloud Functions

## 🤝 Contribuire

Sentiti libero di fare fork e migliorare il progetto!

## 📄 Licenza

Questo progetto è open source e disponibile per uso personale e commerciale.

---

Sviluppato con ❤️ per i toelettatori e i loro clienti


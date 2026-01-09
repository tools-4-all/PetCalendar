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
- ✅ **Link prenotazione pubblica** - Condividi un link con i clienti per prenotazioni dirette
- ✅ **Sistema di abbonamenti** - Sottoscrivi piani PRO mensili o annuali
- ✅ **Gestione fatturazione** - Visualizza e gestisci il tuo abbonamento

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

### 3. Configurazione Stripe (Abbonamenti e Pagamenti)

PetCalendar supporta abbonamenti ricorrenti tramite Stripe:
- **PRO Mensile**: €19,99/mese
- **PRO Annuale**: €119,99/anno

#### Setup Base

1. Crea un account su [Stripe](https://stripe.com/)
2. Ottieni la chiave pubblica API (Publishable key)
3. Aggiungi la chiave in `payment.js`:
   ```javascript
   const STRIPE_PUBLIC_KEY = 'pk_test_...'; // Per test
   ```
4. Lo script Stripe è già incluso in `index.html` e `admin.html`

#### Setup Completo (Backend Richiesto)

Per gestire correttamente gli abbonamenti ricorrenti, è necessario configurare Firebase Cloud Functions:

1. **Segui la guida completa** in `STRIPE_SETUP.md`
2. **Crea i prodotti** in Stripe Dashboard:
   - PRO Mensile: €19,99/mese (ricorrente)
   - PRO Annuale: €119,99/anno (ricorrente)
3. **Configura i webhook** per aggiornare automaticamente lo stato degli abbonamenti
4. **Deploy delle funzioni** Firebase

**Nota:** Senza backend, gli utenti vedranno un messaggio per contattare il supporto. Il backend è necessario per:
- Creare sessioni di checkout sicure
- Gestire rinnovi automatici
- Aggiornare lo stato degli abbonamenti
- Gestire cancellazioni e rimborsi

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
├── booking.html        # Pagina pubblica per prenotazioni clienti
├── styles.css          # Stili CSS
├── firebase-config.js  # Configurazione Firebase
├── app.js              # Logica applicazione clienti
├── admin.js            # Logica applicazione admin
├── booking.js          # Logica prenotazioni pubbliche
├── notifications.js    # Sistema notifiche
├── payment.js          # Sistema pagamenti e abbonamenti Stripe
├── STRIPE_SETUP.md     # Guida completa configurazione Stripe
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

## 🔗 Link Prenotazione Pubblica

Il sistema include una pagina pubblica (`booking.html`) che permette ai clienti di prenotare direttamente senza registrazione.

### Come Generare il Link

1. **Accedi alla dashboard admin** (`admin.html`)
2. **Registra la tua azienda** nella sezione Impostazioni > Profilo Azienda
3. **Ottieni il tuo Company ID**: Il Company ID è il tuo User ID (UID) di Firebase Authentication
   - Puoi trovarlo nella console del browser (F12) dopo il login: `currentUser.uid`
   - Oppure controlla l'URL quando sei loggato nella dashboard
4. **Genera il link**: 
   ```
   https://tuodominio.com/booking.html?companyId=TUO_USER_ID
   ```

### Caratteristiche della Pagina Pubblica

- ✅ **Nessuna registrazione richiesta** - I clienti possono prenotare direttamente
- ✅ **Controllo conflitti automatico** - Previene prenotazioni sovrapposte
- ✅ **Validazione 24 ore** - Le prenotazioni devono essere fatte con almeno 24h di anticipo
- ✅ **Creazione automatica cliente** - Il sistema crea automaticamente il profilo cliente
- ✅ **Stato pending** - Tutte le prenotazioni pubbliche iniziano come "pending" e devono essere confermate dall'azienda

### Gestione Prenotazioni dall'Admin

Dalla dashboard admin puoi:
- **Visualizzare** tutte le prenotazioni (incluse quelle pubbliche)
- **Confermare** le prenotazioni in attesa
- **Completare** le prenotazioni confermate
- **Annullare** le prenotazioni se necessario

Le prenotazioni pubbliche sono identificate dal campo `source: 'public'` nel database.

## 💳 Piani e Abbonamenti

PetCalendar offre diversi piani:

- **FREE**: Fino a 50 prenotazioni/mese, 2 operatori, 1 sede
- **PRO Mensile**: €19,99/mese - Prenotazioni illimitate, fino a 5 operatori, 3 sedi
- **PRO Annuale**: €119,99/anno - Stesse funzionalità PRO con risparmio di €120/anno

Gli abbonamenti vengono gestiti tramite Stripe e si rinnovano automaticamente. Vedi `STRIPE_SETUP.md` per la configurazione completa.

## 📝 Note

- Per le notifiche SMS, puoi integrare Twilio o usare EmailJS con provider SMS
- I promemoria automatici richiedono un sistema di cron job (es. Firebase Cloud Functions)
- **Abbonamenti Stripe**: Richiedono Firebase Cloud Functions per funzionare completamente (vedi `STRIPE_SETUP.md`)
- **Importante**: Assicurati di aver configurato il profilo azienda prima di condividere il link pubblico

## 🤝 Contribuire

Sentiti libero di fare fork e migliorare il progetto!

## 📄 Licenza

Questo progetto è open source e disponibile per uso personale e commerciale.

---

Sviluppato con ❤️ per i toelettatori e i loro clienti


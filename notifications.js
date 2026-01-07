// Sistema di notifiche con EmailJS
// IMPORTANTE: Configura EmailJS su https://www.emailjs.com/
// e aggiungi le tue credenziali qui

const EMAILJS_SERVICE_ID = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE_ID = 'YOUR_TEMPLATE_ID';
const EMAILJS_PUBLIC_KEY = 'YOUR_PUBLIC_KEY';
const EMAILJS_STATUS_TEMPLATE_ID = 'YOUR_STATUS_TEMPLATE_ID';
const EMAILJS_REMINDER_TEMPLATE_ID = 'YOUR_REMINDER_TEMPLATE_ID';

// Carica EmailJS SDK (da aggiungere nell'HTML)
// <script src="https://cdn.jsdelivr.net/npm/@emailjs/browser@3/dist/email.min.js"></script>

// Inizializza EmailJS (chiamare dopo il caricamento della pagina)
function initEmailJS() {
    if (typeof emailjs !== 'undefined') {
        emailjs.init(EMAILJS_PUBLIC_KEY);
    }
}

// Invia notifica per nuova prenotazione
window.sendBookingNotification = async function(bookingData, bookingId) {
    if (typeof emailjs === 'undefined') {
        console.warn('EmailJS non configurato');
        return;
    }

    try {
        const serviceNames = {
            'toelettatura-completa': 'Toelettatura Completa',
            'bagno': 'Bagno',
            'taglio-unghie': 'Taglio Unghie',
            'pulizia-orecchie': 'Pulizia Orecchie',
            'taglio-pelo': 'Taglio Pelo'
        };

        const date = timestampToDate(bookingData.dateTime);
        
        const templateParams = {
            to_email: bookingData.userEmail,
            to_name: bookingData.userEmail.split('@')[0],
            booking_id: bookingId,
            animal_name: bookingData.animalName,
            service: serviceNames[bookingData.service] || bookingData.service,
            date_time: date.toLocaleString('it-IT'),
            payment_method: bookingData.paymentMethod === 'online' ? 'Online' : 'In Presenza',
            notes: bookingData.notes || 'Nessuna nota'
        };

        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
        );

        console.log('Notifica inviata con successo');
    } catch (error) {
        console.error('Errore nell\'invio della notifica:', error);
    }
}

// Invia notifica per cambio stato prenotazione
window.sendStatusNotification = async function(booking, newStatus) {
    if (typeof emailjs === 'undefined') {
        console.warn('EmailJS non configurato');
        return;
    }

    try {
        const statusMessages = {
            'confirmed': 'confermata',
            'completed': 'completata',
            'cancelled': 'annullata'
        };

        const date = timestampToDate(booking.dateTime);
        
        const templateParams = {
            to_email: booking.userEmail,
            to_name: booking.userEmail.split('@')[0],
            booking_id: booking.id || 'N/A',
            animal_name: booking.animalName,
            service: booking.service,
            date_time: date.toLocaleString('it-IT'),
            status: statusMessages[newStatus] || newStatus,
            message: `La tua prenotazione è stata ${statusMessages[newStatus] || newStatus}`
        };

        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_STATUS_TEMPLATE_ID,
            templateParams
        );

        console.log('Notifica stato inviata con successo');
    } catch (error) {
        console.error('Errore nell\'invio della notifica stato:', error);
    }
}

// Invia promemoria (da chiamare periodicamente)
async function sendReminder(booking) {
    if (typeof emailjs === 'undefined') {
        console.warn('EmailJS non configurato');
        return;
    }

    try {
        const date = timestampToDate(booking.dateTime);
        const now = new Date();
        const hoursUntil = (date - now) / (1000 * 60 * 60);

        // Invia promemoria 24 ore prima
        if (hoursUntil > 24 && hoursUntil < 25) {
            const templateParams = {
                to_email: booking.userEmail,
                to_name: booking.userEmail.split('@')[0],
                animal_name: booking.animalName,
                service: booking.service,
                date_time: date.toLocaleString('it-IT'),
                reminder_hours: '24'
            };

            await emailjs.send(
                EMAILJS_SERVICE_ID,
                EMAILJS_REMINDER_TEMPLATE_ID,
                templateParams
            );

            console.log('Promemoria inviato');
        }
    } catch (error) {
        console.error('Errore nell\'invio del promemoria:', error);
    }
}

// Funzione per controllare e inviare promemoria (da eseguire periodicamente)
async function checkAndSendReminders() {
    try {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const dayAfter = new Date(tomorrow);
        dayAfter.setDate(dayAfter.getDate() + 1);

        const snapshot = await db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(tomorrow))
            .where('dateTime', '<', firebase.firestore.Timestamp.fromDate(dayAfter))
            .where('status', 'in', ['pending', 'confirmed'])
            .get();

        snapshot.forEach(async (doc) => {
            const booking = { id: doc.id, ...doc.data() };
            await sendReminder(booking);
        });
    } catch (error) {
        console.error('Errore nel controllo promemoria:', error);
    }
}

// Per SMS, puoi usare servizi come Twilio o integrare con EmailJS SMS
// EmailJS supporta anche SMS tramite alcuni provider


// Variabili globali
let companyId = null;
let companyData = null;

// Durata stimata dei servizi in minuti
const SERVICE_DURATIONS = {
    'toelettatura-completa': 120, // 2 ore
    'bagno': 60, // 1 ora
    'taglio-unghie': 30, // 30 minuti
    'pulizia-orecchie': 30, // 30 minuti
    'taglio-pelo': 90 // 1.5 ore
};

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    console.log('Booking page loaded');
    console.log('Current URL:', window.location.href);
    
    // Verifica che Firebase sia caricato
    if (typeof firebase === 'undefined' || typeof db === 'undefined') {
        console.error('Firebase non è stato caricato correttamente');
        showInitialError('Errore: Firebase non è stato caricato. Verifica la connessione internet e ricarica la pagina.');
        return;
    }
    
    // Ottieni companyId dall'URL
    const urlParams = new URLSearchParams(window.location.search);
    companyId = urlParams.get('companyId') || urlParams.get('id');
    
    console.log('Company ID from URL:', companyId);

    if (!companyId) {
        console.error('CompanyId mancante nell\'URL');
        showInitialError('Link non valido. Manca il parametro companyId.\n\nAssicurati di usare il link completo fornito dalla dashboard admin.');
        return;
    }

    initBookingPage();
});

// Inizializza la pagina
async function initBookingPage() {
    try {
        // Carica dati azienda
        await loadCompanyData();
        
        // Imposta data minima (domani)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        document.getElementById('bookingDate').min = tomorrow.toISOString().split('T')[0];
        
        // Imposta orari di lavoro (esempio: 9:00 - 18:00)
        const timeInput = document.getElementById('bookingTime');
        timeInput.min = '09:00';
        timeInput.max = '18:00';
        
        // Mostra il form
        document.getElementById('loadingState').classList.remove('show');
        document.getElementById('bookingFormContainer').style.display = 'block';
        
        // Event listeners
        setupEventListeners();
    } catch (error) {
        console.error('Errore nell\'inizializzazione:', error);
        showInitialError('Errore nel caricamento dei dati. Riprova più tardi.');
    }
}

// Carica dati azienda
async function loadCompanyData() {
    try {
        const companyDoc = await db.collection('companies').doc(companyId).get();
        
        if (!companyDoc.exists) {
            throw new Error('Azienda non trovata. Verifica che il link sia corretto.');
        }
        
        companyData = { id: companyDoc.id, ...companyDoc.data() };
        
        // Mostra informazioni azienda
        const companyNameEl = document.getElementById('companyName');
        const companyDetailsEl = document.getElementById('companyDetails');
        
        if (companyNameEl) {
            companyNameEl.textContent = companyData.name || 'Azienda di Toelettatura';
        }
        
        if (companyDetailsEl) {
            let details = [];
            if (companyData.address) details.push(companyData.address);
            if (companyData.city) details.push(companyData.city);
            if (companyData.phone) details.push(`Tel: ${companyData.phone}`);
            if (companyData.email) details.push(`Email: ${companyData.email}`);
            
            companyDetailsEl.textContent = details.join(' | ') || 'Informazioni azienda';
        }
    } catch (error) {
        console.error('Errore nel caricamento azienda:', error);
        throw error;
    }
}

// Setup event listeners
function setupEventListeners() {
    const form = document.getElementById('bookingForm');
    const dateInput = document.getElementById('bookingDate');
    const timeInput = document.getElementById('bookingTime');
    
    // Controlla conflitti quando cambiano data/ora
    dateInput.addEventListener('change', () => checkConflicts());
    timeInput.addEventListener('change', () => checkConflicts());
    
    // Submit form
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await submitBooking();
    });
}

// Controlla conflitti con altre prenotazioni
async function checkConflicts() {
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    const service = document.getElementById('service').value;
    
    if (!date || !time || !service) {
        hideConflictWarning();
        return;
    }
    
    try {
        // Crea data/ora prenotazione
        const bookingDateTime = new Date(`${date}T${time}`);
        
        // Verifica che la data sia nel futuro
        const now = new Date();
        if (bookingDateTime <= now) {
            showConflictWarning('La data e ora devono essere nel futuro.');
            return;
        }
        
        // Verifica che sia almeno 24 ore nel futuro
        const minDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        if (bookingDateTime < minDateTime) {
            showConflictWarning('Le prenotazioni devono essere effettuate con almeno 24 ore di anticipo.');
            return;
        }
        
        // Durata del servizio
        const duration = SERVICE_DURATIONS[service] || 60; // default 60 minuti
        const endDateTime = new Date(bookingDateTime.getTime() + duration * 60 * 1000);
        
        // Cerca prenotazioni esistenti nello stesso slot temporale
        const startTimestamp = firebase.firestore.Timestamp.fromDate(bookingDateTime);
        const endTimestamp = firebase.firestore.Timestamp.fromDate(endDateTime);
        
        // Query per trovare prenotazioni sovrapposte
        // Cerca prenotazioni che:
        // 1. Hanno lo stesso companyId
        // 2. Sono nello stesso intervallo temporale
        // 3. Non sono cancellate o completate
        
        const conflictsQuery = await db.collection('bookings')
            .where('companyId', '==', companyId)
            .where('status', 'in', ['pending', 'confirmed'])
            .where('dateTime', '>=', startTimestamp)
            .where('dateTime', '<', endTimestamp)
            .get();
        
        // Controlla anche prenotazioni che iniziano prima ma finiscono durante il nostro slot
        const conflictsBeforeQuery = await db.collection('bookings')
            .where('companyId', '==', companyId)
            .where('status', 'in', ['pending', 'confirmed'])
            .where('dateTime', '<', startTimestamp)
            .get();
        
        // Verifica se ci sono conflitti
        let hasConflict = false;
        
        // Controlla prenotazioni nello stesso slot
        if (!conflictsQuery.empty) {
            hasConflict = true;
        }
        
        // Controlla prenotazioni che iniziano prima ma potrebbero sovrapporsi
        if (!conflictsBeforeQuery.empty) {
            conflictsBeforeQuery.forEach(doc => {
                const booking = doc.data();
                const bookingStart = booking.dateTime.toDate();
                const serviceDuration = SERVICE_DURATIONS[booking.service] || 60;
                const bookingEnd = new Date(bookingStart.getTime() + serviceDuration * 60 * 1000);
                
                // Se la prenotazione esistente finisce dopo l'inizio della nostra, c'è conflitto
                if (bookingEnd > bookingDateTime) {
                    hasConflict = true;
                }
            });
        }
        
        if (hasConflict) {
            showConflictWarning('Questo slot temporale è già occupato. Ti consigliamo di scegliere un altro orario.');
        } else {
            hideConflictWarning();
        }
    } catch (error) {
        console.error('Errore nel controllo conflitti:', error);
        // Non bloccare la prenotazione se c'è un errore nel controllo
        hideConflictWarning();
    }
}

// Mostra warning conflitto
function showConflictWarning(message) {
    const warning = document.getElementById('conflictWarning');
    const details = document.getElementById('conflictDetails');
    
    if (details) {
        details.textContent = message;
    }
    
    if (warning) {
        warning.classList.add('show');
    }
}

// Nascondi warning conflitto
function hideConflictWarning() {
    const warning = document.getElementById('conflictWarning');
    if (warning) {
        warning.classList.remove('show');
    }
}

// Invia prenotazione
async function submitBooking() {
    // Reset messaggi
    hideMessages();
    
    // Validazione
    if (!validateForm()) {
        return;
    }
    
    // Disabilita submit button
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Invio in corso...';
    
    try {
        // Raccogli dati form
        const clientName = document.getElementById('clientName').value.trim();
        const clientEmail = document.getElementById('clientEmail').value.trim();
        const clientPhone = document.getElementById('clientPhone').value.trim();
        const animalName = document.getElementById('animalName').value.trim();
        const animalType = document.getElementById('animalType').value;
        const animalBreed = document.getElementById('animalBreed').value.trim();
        const service = document.getElementById('service').value;
        const date = document.getElementById('bookingDate').value;
        const time = document.getElementById('bookingTime').value;
        const notes = document.getElementById('notes').value.trim();
        
        // Crea data/ora prenotazione
        const bookingDateTime = new Date(`${date}T${time}`);
        const now = new Date();
        
        // Validazione data
        if (bookingDateTime <= now) {
            throw new Error('La data e ora devono essere nel futuro.');
        }
        
        // Verifica 24 ore di anticipo
        const minDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        if (bookingDateTime < minDateTime) {
            throw new Error('Le prenotazioni devono essere effettuate con almeno 24 ore di anticipo.');
        }
        
        // Controllo finale conflitti (doppio controllo)
        await checkConflicts();
        const conflictWarning = document.getElementById('conflictWarning');
        if (conflictWarning && conflictWarning.classList.contains('show')) {
            throw new Error('Questo slot temporale è già occupato. Scegli un altro orario.');
        }
        
        // Cerca o crea cliente
        let userId = null;
        let userEmail = clientEmail;
        
        if (clientEmail) {
            // Cerca cliente esistente per email
            const usersQuery = await db.collection('users')
                .where('email', '==', clientEmail)
                .limit(1)
                .get();
            
            if (!usersQuery.empty) {
                userId = usersQuery.docs[0].id;
                // Aggiorna dati cliente se necessario
                const userData = usersQuery.docs[0].data();
                await db.collection('users').doc(userId).update({
                    displayName: clientName,
                    phone: clientPhone || userData.phone || '',
                    updatedAt: getTimestamp()
                });
            } else {
                // Crea nuovo cliente
                const newUserRef = db.collection('users').doc();
                userId = newUserRef.id;
                await newUserRef.set({
                    email: clientEmail,
                    displayName: clientName,
                    phone: clientPhone || '',
                    address: '',
                    createdAt: getTimestamp(),
                    updatedAt: getTimestamp()
                });
            }
        } else {
            // Crea cliente senza email
            const newUserRef = db.collection('users').doc();
            userId = newUserRef.id;
            await newUserRef.set({
                email: '',
                displayName: clientName,
                phone: clientPhone || '',
                address: '',
                createdAt: getTimestamp(),
                updatedAt: getTimestamp()
            });
        }
        
        // Crea prenotazione
        const bookingData = {
            companyId: companyId,
            userId: userId,
            userName: clientName,
            userEmail: userEmail,
            userPhone: clientPhone,
            animalName: animalName,
            animalType: animalType,
            animalBreed: animalBreed || '',
            service: service,
            dateTime: firebase.firestore.Timestamp.fromDate(bookingDateTime),
            notes: notes || '',
            paymentMethod: 'presenza', // Default: pagamento in presenza
            status: 'pending', // Sempre pending per prenotazioni pubbliche
            source: 'public', // Indica che proviene dalla pagina pubblica
            createdAt: getTimestamp(),
            updatedAt: getTimestamp()
        };
        
        // Salva prenotazione
        const bookingRef = await db.collection('bookings').add(bookingData);
        
        // Successo!
        showSuccess(`Prenotazione inviata con successo! Il numero di prenotazione è: ${bookingRef.id.substring(0, 8).toUpperCase()}. 
                     L'azienda ti contatterà per confermare l'appuntamento.`);
        
        // Reset form
        document.getElementById('bookingForm').reset();
        
        // Scrolla in alto
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        console.error('Errore nella creazione prenotazione:', error);
        showError(error.message || 'Errore nell\'invio della prenotazione. Riprova più tardi.');
    } finally {
        // Riabilita submit button
        submitBtn.disabled = false;
        submitBtn.textContent = 'Invia Prenotazione';
    }
}

// Valida form
function validateForm() {
    const clientName = document.getElementById('clientName').value.trim();
    const clientEmail = document.getElementById('clientEmail').value.trim();
    const clientPhone = document.getElementById('clientPhone').value.trim();
    const animalName = document.getElementById('animalName').value.trim();
    const animalType = document.getElementById('animalType').value;
    const service = document.getElementById('service').value;
    const date = document.getElementById('bookingDate').value;
    const time = document.getElementById('bookingTime').value;
    
    if (!clientName) {
        showError('Inserisci nome e cognome.');
        return false;
    }
    
    if (!clientEmail || !isValidEmail(clientEmail)) {
        showError('Inserisci un\'email valida.');
        return false;
    }
    
    if (!clientPhone) {
        showError('Inserisci un numero di telefono.');
        return false;
    }
    
    if (!animalName) {
        showError('Inserisci il nome dell\'animale.');
        return false;
    }
    
    if (!animalType) {
        showError('Seleziona il tipo di animale.');
        return false;
    }
    
    if (!service) {
        showError('Seleziona un servizio.');
        return false;
    }
    
    if (!date || !time) {
        showError('Seleziona data e ora.');
        return false;
    }
    
    // Verifica data futura
    const bookingDateTime = new Date(`${date}T${time}`);
    const now = new Date();
    
    if (bookingDateTime <= now) {
        showError('La data e ora devono essere nel futuro.');
        return false;
    }
    
    // Verifica 24 ore di anticipo
    const minDateTime = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    if (bookingDateTime < minDateTime) {
        showError('Le prenotazioni devono essere effettuate con almeno 24 ore di anticipo.');
        return false;
    }
    
    return true;
}

// Valida email
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Mostra errore
function showError(message) {
    const errorEl = document.getElementById('errorMessage');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.add('show');
    }
    
    // Scrolla all'errore
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Mostra successo
function showSuccess(message) {
    const successEl = document.getElementById('successMessage');
    if (successEl) {
        successEl.textContent = message;
        successEl.classList.add('show');
    }
}

// Nascondi messaggi
function hideMessages() {
    const errorEl = document.getElementById('errorMessage');
    const successEl = document.getElementById('successMessage');
    
    if (errorEl) errorEl.classList.remove('show');
    if (successEl) successEl.classList.remove('show');
}

// Mostra errore generale (per errori di inizializzazione)
function showInitialError(message) {
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    const errorMsgEl = document.getElementById('errorMessage');
    
    if (loadingState) {
        loadingState.classList.remove('show');
    }
    
    if (errorState) {
        errorState.style.display = 'block';
    }
    
    if (errorMsgEl) {
        errorMsgEl.textContent = message;
    }
    
    // Mostra informazioni di debug
    const currentUrlDebug = document.getElementById('currentUrlDebug');
    const companyIdDebug = document.getElementById('companyIdDebug');
    
    if (currentUrlDebug) {
        currentUrlDebug.textContent = window.location.href;
    }
    
    if (companyIdDebug) {
        const urlParams = new URLSearchParams(window.location.search);
        companyIdDebug.textContent = urlParams.get('companyId') || urlParams.get('id') || 'Nessuno';
    }
    
    console.error('Errore inizializzazione:', message);
    console.error('URL corrente:', window.location.href);
    console.error('Company ID:', companyId);
}


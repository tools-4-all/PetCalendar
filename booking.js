// Variabili globali
let companyId = null;
let companyData = null;

// Durata stimata dei servizi in minuti (fallback se non disponibile da Firestore)
const SERVICE_DURATIONS = {
    'toelettatura-completa': 120, // 2 ore
    'bagno': 60, // 1 ora
    'taglio-unghie': 30, // 30 minuti
    'pulizia-orecchie': 30, // 30 minuti
    'taglio-pelo': 90 // 1.5 ore
};

// Cache servizi caricati da Firestore
let servicesCache = {};

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    console.log('Booking page loaded');
    console.log('Current URL:', window.location.href);
    
    // Verifica se sta usando file:// invece di http://
    const currentUrl = window.location.href;
    const isFileProtocol = currentUrl.startsWith('file://');
    
    if (isFileProtocol) {
        console.error('⚠️ ATTENZIONE: Stai usando file:// invece di un server HTTP!');
        showInitialError('⚠️ IMPORTANTE: Devi usare un server HTTP!\n\n' +
            'Firebase non funziona con file:// (doppio click sul file).\n\n' +
            'Come avviare il server:\n' +
            '1. Apri il terminale nella directory del progetto\n' +
            '2. Esegui: python3 -m http.server 8000\n' +
            '3. Apri nel browser: http://localhost:8000/booking.html?companyId=...\n\n' +
            'Alternative:\n' +
            '- Node.js: npx http-server -p 8000\n' +
            '- PHP: php -S localhost:8000\n' +
            '- VS Code: Estensione "Live Server"');
        return;
    }
    
    // Aspetta che Firebase sia caricato (può richiedere qualche millisecondo)
    setTimeout(() => {
        // Verifica che Firebase sia caricato
        if (typeof firebase === 'undefined') {
            console.error('Firebase non è stato caricato correttamente');
            showInitialError('Errore: Firebase non è stato caricato. Verifica che firebase-config.js sia presente e ricarica la pagina.');
            return;
        }
        
        if (typeof db === 'undefined') {
            console.error('Database Firestore non inizializzato');
            showInitialError('Errore: Database Firestore non inizializzato. Verifica la configurazione Firebase e ricarica la pagina.');
            return;
        }
        
        // Ottieni companyId dall'URL - prova diversi metodi
        const urlParams = new URLSearchParams(window.location.search);
        companyId = urlParams.get('companyId') || urlParams.get('id');
        
        // Metodo 2: Prova a prenderlo dal pathname (per server che fanno routing come /booking/:companyId)
        if (!companyId) {
            const pathParts = window.location.pathname.split('/').filter(p => p);
            const bookingIndex = pathParts.findIndex(p => p === 'booking' || p.startsWith('booking'));
            if (bookingIndex >= 0 && pathParts[bookingIndex + 1]) {
                companyId = pathParts[bookingIndex + 1];
                console.log('Company ID trovato nel pathname:', companyId);
            }
        }
        
        // Metodo 3: Prova a prenderlo dall'hash (#companyId=...)
        if (!companyId && window.location.hash) {
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            companyId = hashParams.get('companyId') || hashParams.get('id');
            if (companyId) {
                console.log('Company ID trovato nell\'hash:', companyId);
            }
        }
        
        // Metodo 4: Prova a recuperarlo da sessionStorage (salvato quando si genera il link)
        if (!companyId) {
            const storedCompanyId = sessionStorage.getItem('booking_companyId');
            if (storedCompanyId) {
                companyId = storedCompanyId;
                console.log('Company ID recuperato da sessionStorage:', companyId);
            }
        }
        
        console.log('Company ID from URL:', companyId);
        console.log('URL completo:', window.location.href);
        console.log('Pathname:', window.location.pathname);
        console.log('Search params:', window.location.search);
        console.log('Hash:', window.location.hash);

        if (!companyId) {
            console.error('CompanyId mancante nell\'URL');
            console.error('Tentativi falliti:');
            console.error('  - Query params:', window.location.search);
            console.error('  - Hash:', window.location.hash);
            console.error('  - Pathname:', window.location.pathname);
            console.error('  - SessionStorage:', sessionStorage.getItem('booking_companyId'));
            
            showInitialError('Link non valido. Manca il parametro companyId.\n\n' +
                'Possibili cause:\n' +
                '1. Il server sta facendo un redirect che rimuove i parametri\n' +
                '2. Il link è stato copiato senza i parametri\n' +
                '3. Il browser ha perso i parametri durante la navigazione\n\n' +
                'Soluzione:\n' +
                '1. Vai alla dashboard admin\n' +
                '2. Copia di nuovo il link completo dalla sezione "Link Prenotazione Pubblica"\n' +
                '3. Assicurati che il link contenga "?companyId=..."\n' +
                '4. Se il problema persiste, prova a incollare il link direttamente nella barra degli indirizzi\n\n' +
                'URL attuale: ' + window.location.href);
            return;
        }

        initBookingPage();
    }, 100); // Aspetta 100ms per assicurarsi che gli script siano caricati
});

// Inizializza la pagina
async function initBookingPage() {
    try {
        // Carica dati azienda
        await loadCompanyData();
        
        // Carica servizi
        await loadServices();
        
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
    let companyDoc = null;
    let docExists = false;
    
    try {
        companyDoc = await db.collection('companies').doc(companyId).get();
        docExists = companyDoc.exists;
        
        // Se il documento non esiste, usa dati di default (non creiamo il documento perché richiede autenticazione)
        if (!docExists) {
            console.log('Documento azienda non trovato, uso dati di default');
            console.log('Nota: Compila il profilo azienda nella dashboard per personalizzare queste informazioni');
            
            // Usa dati di default senza creare il documento (richiede autenticazione)
            companyData = {
                id: companyId,
                name: 'Azienda di Toelettatura'
            };
        } else {
            companyData = { id: companyDoc.id, ...companyDoc.data() };
        }
        
        // Mostra informazioni azienda
        const companyNameEl = document.getElementById('companyName');
        const companyDetailsEl = document.getElementById('companyDetails');
        
        if (companyNameEl) {
            companyNameEl.textContent = companyData.name || 'Azienda di Toelettatura';
        }
        
        if (companyDetailsEl) {
            if (!docExists) {
                // Se il documento non esiste, mostra messaggio informativo
                companyDetailsEl.textContent = 'Compila il profilo azienda nella dashboard per mostrare le informazioni qui.';
                companyDetailsEl.style.fontStyle = 'italic';
                companyDetailsEl.style.color = '#666';
            } else {
                let details = [];
                if (companyData.address) details.push(companyData.address);
                if (companyData.city) details.push(companyData.city);
                if (companyData.phone) details.push(`Tel: ${companyData.phone}`);
                if (companyData.email) details.push(`Email: ${companyData.email}`);
                
                companyDetailsEl.textContent = details.length > 0 
                    ? details.join(' | ') 
                    : 'Compila il profilo azienda nella dashboard per mostrare le informazioni qui.';
            }
        }
    } catch (error) {
        console.error('Errore nel caricamento azienda:', error);
        // Anche in caso di errore, permette alla pagina di funzionare con dati di default
        companyData = {
            id: companyId,
            name: 'Azienda di Toelettatura'
        };
        
        const companyNameEl = document.getElementById('companyName');
        const companyDetailsEl = document.getElementById('companyDetails');
        
        if (companyNameEl) {
            companyNameEl.textContent = 'Azienda di Toelettatura';
        }
        
        if (companyDetailsEl) {
            companyDetailsEl.textContent = 'Errore nel caricamento informazioni azienda. La prenotazione funzionerà comunque.';
            companyDetailsEl.style.fontStyle = 'italic';
            companyDetailsEl.style.color = '#666';
        }
        
        console.warn('Uso dati azienda di default a causa di errore:', error);
    }
}

// Carica servizi da Firestore
async function loadServices() {
    if (!companyId) return;
    
    try {
        const snapshot = await db.collection('services')
            .where('companyId', '==', companyId)
            .get();
        
        const serviceSelect = document.getElementById('service');
        if (!serviceSelect) return;
        
        // Pulisci select mantenendo solo l'opzione "Seleziona"
        const firstOption = serviceSelect.querySelector('option[value=""]');
        serviceSelect.innerHTML = '';
        if (firstOption) {
            serviceSelect.appendChild(firstOption);
        }
        
        // Svuota cache
        servicesCache = {};
        
        // Ordina servizi per nome lato client
        const servicesArray = [];
        snapshot.forEach(doc => {
            servicesArray.push({ id: doc.id, ...doc.data() });
        });
        
        servicesArray.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        if (servicesArray.length === 0) {
            // Se non ci sono servizi, usa quelli di default
            const defaultServices = [
                { id: 'toelettatura-completa', name: 'Toelettatura Completa', duration: 120 },
                { id: 'bagno', name: 'Bagno', duration: 60 },
                { id: 'taglio-unghie', name: 'Taglio Unghie', duration: 30 },
                { id: 'pulizia-orecchie', name: 'Pulizia Orecchie', duration: 30 },
                { id: 'taglio-pelo', name: 'Taglio Pelo', duration: 90 }
            ];
            
            defaultServices.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = service.name;
                serviceSelect.appendChild(option);
                servicesCache[service.id] = service;
            });
        } else {
            servicesArray.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = service.name;
                serviceSelect.appendChild(option);
                servicesCache[service.id] = service;
            });
        }
    } catch (error) {
        console.error('Errore nel caricamento servizi:', error);
        // Usa servizi di default in caso di errore
        const serviceSelect = document.getElementById('service');
        if (serviceSelect && serviceSelect.children.length <= 1) {
            const defaultServices = [
                { id: 'toelettatura-completa', name: 'Toelettatura Completa', duration: 120 },
                { id: 'bagno', name: 'Bagno', duration: 60 },
                { id: 'taglio-unghie', name: 'Taglio Unghie', duration: 30 },
                { id: 'pulizia-orecchie', name: 'Pulizia Orecchie', duration: 30 },
                { id: 'taglio-pelo', name: 'Taglio Pelo', duration: 90 }
            ];
            
            defaultServices.forEach(service => {
                const option = document.createElement('option');
                option.value = service.id;
                option.textContent = service.name;
                serviceSelect.appendChild(option);
                servicesCache[service.id] = service;
            });
        }
    }
}

// Ottieni durata servizio (da cache o fallback)
function getServiceDuration(serviceId) {
    if (servicesCache[serviceId]) {
        return servicesCache[serviceId].duration || 60; // Default 60 minuti se non specificato
    }
    return SERVICE_DURATIONS[serviceId] || 60; // Default 60 minuti
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
        const duration = getServiceDuration(service); // default 60 minuti
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
                const serviceDuration = getServiceDuration(booking.service);
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
        
        // Controlla il limite di prenotazioni mensili per aziende FREE
        const subscriptionDoc = await db.collection('subscriptions').doc(companyId).get();
        const subscription = subscriptionDoc.exists ? subscriptionDoc.data() : null;
        
        // Verifica se l'azienda ha un abbonamento FREE o nessun abbonamento
        const isFreePlan = !subscription || 
                          !subscription.plan || 
                          subscription.plan === 'free' ||
                          (subscription.status !== 'active');
        
        if (isFreePlan) {
            // Conta le prenotazioni del mese corrente
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            
            const monthlyBookingsQuery = await db.collection('bookings')
                .where('companyId', '==', companyId)
                .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(startOfMonth))
                .where('dateTime', '<=', firebase.firestore.Timestamp.fromDate(endOfMonth))
                .get();
            
            const monthlyBookingsCount = monthlyBookingsQuery.size;
            const FREE_PLAN_LIMIT = 20;
            
            if (monthlyBookingsCount >= FREE_PLAN_LIMIT) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Invia Prenotazione';
                showError(`L'azienda ha superato il limite di ${FREE_PLAN_LIMIT} prenotazioni mensili del piano FREE.\n\n` +
                         `Prenotazioni del mese corrente: ${monthlyBookingsCount}/${FREE_PLAN_LIMIT}\n\n` +
                         `Per creare più prenotazioni, l'azienda deve passare al piano PRO (€19/mese o €119/anno) che offre prenotazioni illimitate.\n\n` +
                         `Contatta l'azienda per maggiori informazioni.`);
                return;
            }
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
    
    // Email è opzionale, ma se fornita deve essere valida
    if (clientEmail && !isValidEmail(clientEmail)) {
        showError('Inserisci un\'email valida o lascia il campo vuoto.');
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


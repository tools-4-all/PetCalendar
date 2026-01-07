// Variabili globali
let currentUser = null;
let adminCalendar = null;
let selectedDate = new Date();

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initCalendar();
    initModals();
    initEventListeners();
    loadAdminData();
    
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadAdminData();
        } else {
            // Reindirizza al login se non autenticato
            window.location.href = 'index.html';
        }
    });
});

// Autenticazione
function initAuth() {
    const logoutBtn = document.getElementById('logoutBtn');
    
    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.href = 'index.html';
        } catch (error) {
            alert('Errore durante il logout: ' + error.message);
        }
    });
}

// Calendario Admin
function initCalendar() {
    const calendarEl = document.getElementById('adminCalendar');
    
    adminCalendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'timeGridDay',
        locale: 'it',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        slotMinTime: '08:00:00',
        slotMaxTime: '20:00:00',
        events: [],
        eventClick: (info) => {
            showBookingDetail(info.event.id);
        },
        dateClick: (info) => {
            selectedDate = info.date;
            loadDayBookings();
        }
    });

    adminCalendar.render();
}

// Modali
function initModals() {
    const modals = document.querySelectorAll('.modal');
    const closeBtns = document.querySelectorAll('.close');

    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.modal').classList.remove('show');
        });
    });

    modals.forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    });
}

// Event Listeners
function initEventListeners() {
    const selectedDateInput = document.getElementById('selectedDate');
    const todayBtn = document.getElementById('todayBtn');
    
    selectedDateInput.addEventListener('change', (e) => {
        selectedDate = new Date(e.target.value);
        adminCalendar.gotoDate(selectedDate);
        loadDayBookings();
    });

    todayBtn.addEventListener('click', () => {
        selectedDate = new Date();
        selectedDateInput.value = selectedDate.toISOString().split('T')[0];
        adminCalendar.gotoDate(selectedDate);
        loadDayBookings();
    });

    // Imposta data di oggi
    selectedDateInput.value = new Date().toISOString().split('T')[0];

    // Azioni prenotazione
    document.getElementById('confirmBookingBtn').addEventListener('click', () => {
        updateBookingStatus('confirmed');
    });

    document.getElementById('completeBookingBtn').addEventListener('click', () => {
        updateBookingStatus('completed');
    });

    document.getElementById('cancelBookingBtn').addEventListener('click', () => {
        if (confirm('Sei sicuro di voler annullare questa prenotazione?')) {
            updateBookingStatus('cancelled');
        }
    });
}

// Caricamento dati admin
async function loadAdminData() {
    if (!currentUser) return;
    
    loadCalendarEvents();
    loadDayBookings();
    loadStats();
}

// Carica eventi calendario
async function loadCalendarEvents() {
    try {
        const snapshot = await db.collection('bookings')
            .where('status', 'in', ['pending', 'confirmed'])
            .orderBy('dateTime', 'asc')
            .get();

        const events = [];
        snapshot.forEach(doc => {
            const booking = doc.data();
            const date = timestampToDate(booking.dateTime);
            
            let color = '#f39c12'; // pending
            if (booking.status === 'confirmed') {
                color = '#4a90e2';
            }
            
            events.push({
                id: doc.id,
                title: `${booking.animalName} - ${booking.service}`,
                start: date.toISOString(),
                backgroundColor: color,
                extendedProps: {
                    booking: { id: doc.id, ...booking }
                }
            });
        });

        adminCalendar.removeAllEvents();
        adminCalendar.addEventSource(events);
    } catch (error) {
        console.error('Errore nel caricamento eventi:', error);
    }
}

// Carica prenotazioni del giorno
async function loadDayBookings() {
    if (!selectedDate) return;

    const startOfDay = new Date(selectedDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(selectedDate);
    endOfDay.setHours(23, 59, 59, 999);

    try {
        const snapshot = await db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(startOfDay))
            .where('dateTime', '<=', firebase.firestore.Timestamp.fromDate(endOfDay))
            .orderBy('dateTime', 'asc')
            .get();

        const bookingsList = document.getElementById('adminBookingsList');
        bookingsList.innerHTML = '';

        if (snapshot.empty) {
            bookingsList.innerHTML = '<p>Nessuna prenotazione per questo giorno</p>';
            return;
        }

        snapshot.forEach(doc => {
            const booking = { id: doc.id, ...doc.data() };
            const bookingCard = createAdminBookingCard(booking);
            bookingsList.appendChild(bookingCard);
        });
    } catch (error) {
        console.error('Errore nel caricamento prenotazioni:', error);
    }
}

function createAdminBookingCard(booking) {
    const card = document.createElement('div');
    card.className = `booking-card ${booking.status}`;
    card.onclick = () => showBookingDetail(booking.id);
    card.style.cursor = 'pointer';
    
    const date = timestampToDate(booking.dateTime);
    const serviceNames = {
        'toelettatura-completa': 'Toelettatura Completa',
        'bagno': 'Bagno',
        'taglio-unghie': 'Taglio Unghie',
        'pulizia-orecchie': 'Pulizia Orecchie',
        'taglio-pelo': 'Taglio Pelo'
    };

    card.innerHTML = `
        <div class="booking-card-header">
            <h4>${booking.animalName} (${booking.animalType})</h4>
            <span class="booking-status ${booking.status}">${booking.status}</span>
        </div>
        <p><strong>Servizio:</strong> ${serviceNames[booking.service] || booking.service}</p>
        <p><strong>Orario:</strong> ${date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</p>
        <p><strong>Cliente:</strong> ${booking.userEmail}</p>
        <p><strong>Pagamento:</strong> ${booking.paymentMethod === 'online' ? 'Online ✓' : 'In Presenza'}</p>
    `;

    return card;
}

// Mostra dettagli prenotazione
async function showBookingDetail(bookingId) {
    try {
        const doc = await db.collection('bookings').doc(bookingId).get();
        if (!doc.exists) {
            alert('Prenotazione non trovata');
            return;
        }

        const booking = { id: doc.id, ...doc.data() };
        const modal = document.getElementById('bookingDetailModal');
        const details = document.getElementById('bookingDetails');
        
        const date = timestampToDate(booking.dateTime);
        const serviceNames = {
            'toelettatura-completa': 'Toelettatura Completa',
            'bagno': 'Bagno',
            'taglio-unghie': 'Taglio Unghie',
            'pulizia-orecchie': 'Pulizia Orecchie',
            'taglio-pelo': 'Taglio Pelo'
        };

        // Carica dati animale
        let animalData = {};
        if (booking.animalId) {
            const animalDoc = await db.collection('animals').doc(booking.animalId).get();
            if (animalDoc.exists) {
                animalData = animalDoc.data();
            }
        }

        details.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Animale:</span>
                <span class="detail-value">${booking.animalName} (${booking.animalType})</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Razza:</span>
                <span class="detail-value">${animalData.breed || 'N/A'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Servizio:</span>
                <span class="detail-value">${serviceNames[booking.service] || booking.service}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Data e Ora:</span>
                <span class="detail-value">${date.toLocaleString('it-IT')}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Cliente:</span>
                <span class="detail-value">${booking.userEmail}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Pagamento:</span>
                <span class="detail-value">${booking.paymentMethod === 'online' ? 'Online' : 'In Presenza'}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Stato:</span>
                <span class="detail-value"><span class="booking-status ${booking.status}">${booking.status}</span></span>
            </div>
            ${animalData.notes ? `
            <div class="detail-row">
                <span class="detail-label">Note Animale:</span>
                <span class="detail-value">${animalData.notes}</span>
            </div>
            ` : ''}
            ${booking.notes ? `
            <div class="detail-row">
                <span class="detail-label">Note Prenotazione:</span>
                <span class="detail-value">${booking.notes}</span>
            </div>
            ` : ''}
        `;

        // Salva bookingId per le azioni
        modal.dataset.bookingId = bookingId;
        
        // Mostra/nascondi pulsanti in base allo stato
        const confirmBtn = document.getElementById('confirmBookingBtn');
        const completeBtn = document.getElementById('completeBookingBtn');
        const cancelBtn = document.getElementById('cancelBookingBtn');

        confirmBtn.style.display = booking.status === 'pending' ? 'block' : 'none';
        completeBtn.style.display = booking.status === 'confirmed' ? 'block' : 'none';
        cancelBtn.style.display = booking.status !== 'cancelled' && booking.status !== 'completed' ? 'block' : 'none';

        modal.classList.add('show');
    } catch (error) {
        alert('Errore nel caricamento dettagli: ' + error.message);
    }
}

// Aggiorna stato prenotazione
async function updateBookingStatus(newStatus) {
    const modal = document.getElementById('bookingDetailModal');
    const bookingId = modal.dataset.bookingId;

    if (!bookingId) return;

    try {
        const bookingRef = db.collection('bookings').doc(bookingId);
        const bookingDoc = await bookingRef.get();
        const booking = bookingDoc.data();

        await bookingRef.update({
            status: newStatus,
            updatedAt: getTimestamp()
        });

        // Invia notifica se confermata o completata
        if (newStatus === 'confirmed' || newStatus === 'completed') {
            await sendStatusNotification(booking, newStatus);
        }

        modal.classList.remove('show');
        loadAdminData();
        alert(`Prenotazione ${newStatus} con successo!`);
    } catch (error) {
        alert('Errore nell\'aggiornamento: ' + error.message);
    }
}

// Statistiche
async function loadStats() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    try {
        // Prenotazioni oggi
        const todaySnapshot = await db.collection('bookings')
            .where('dateTime', '>=', firebase.firestore.Timestamp.fromDate(today))
            .where('dateTime', '<', firebase.firestore.Timestamp.fromDate(tomorrow))
            .get();

        document.getElementById('todayBookings').textContent = todaySnapshot.size;

        // Prenotazioni in attesa
        const pendingSnapshot = await db.collection('bookings')
            .where('status', '==', 'pending')
            .get();

        document.getElementById('pendingBookings').textContent = pendingSnapshot.size;

        // Prenotazioni completate
        const completedSnapshot = await db.collection('bookings')
            .where('status', '==', 'completed')
            .get();

        document.getElementById('completedBookings').textContent = completedSnapshot.size;
    } catch (error) {
        console.error('Errore nel caricamento statistiche:', error);
    }
}

// Notifiche
async function sendStatusNotification(booking, status) {
    if (typeof window.sendStatusNotification === 'function') {
        await window.sendStatusNotification(booking, status);
    } else {
        console.log('Invio notifica cambio stato:', status, booking);
    }
}


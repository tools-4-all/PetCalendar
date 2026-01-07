// Variabili globali
let currentUser = null;
let calendar = null;
let userAnimals = [];

// Inizializzazione
document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    initCalendar();
    initModals();
    initEventListeners();
    
    // Verifica se l'utente è già autenticato
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            document.getElementById('loginBtn').style.display = 'none';
            document.getElementById('logoutBtn').style.display = 'block';
            loadUserData();
        } else {
            currentUser = null;
            document.getElementById('loginBtn').style.display = 'block';
            document.getElementById('logoutBtn').style.display = 'none';
        }
    });
});

// Autenticazione
function initAuth() {
    const loginModal = document.getElementById('loginModal');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const authForm = document.getElementById('authForm');
    const registerBtn = document.getElementById('registerBtn');

    loginBtn.addEventListener('click', () => {
        loginModal.classList.add('show');
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await auth.signOut();
            window.location.reload();
        } catch (error) {
            alert('Errore durante il logout: ' + error.message);
        }
    });

    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        try {
            await auth.signInWithEmailAndPassword(email, password);
            loginModal.classList.remove('show');
            authForm.reset();
        } catch (error) {
            alert('Errore durante il login: ' + error.message);
        }
    });

    registerBtn.addEventListener('click', async () => {
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;

        if (!email || !password) {
            alert('Inserisci email e password');
            return;
        }

        try {
            await auth.createUserWithEmailAndPassword(email, password);
            loginModal.classList.remove('show');
            document.getElementById('authForm').reset();
        } catch (error) {
            alert('Errore durante la registrazione: ' + error.message);
        }
    });
}

// Calendario
function initCalendar() {
    const calendarEl = document.getElementById('calendar');
    
    calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'it',
        headerToolbar: {
            left: 'prev,next today',
            center: 'title',
            right: 'dayGridMonth,timeGridWeek,timeGridDay'
        },
        events: [],
        eventClick: (info) => {
            showBookingDetails(info.event);
        },
        dateClick: (info) => {
            if (currentUser) {
                openBookingModal(info.dateStr);
            } else {
                alert('Devi effettuare il login per prenotare');
            }
        }
    });

    calendar.render();
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
    document.getElementById('addAnimalBtn').addEventListener('click', () => {
        if (!currentUser) {
            alert('Devi effettuare il login');
            return;
        }
        document.getElementById('animalModal').classList.add('show');
        loadAnimals();
    });

    document.getElementById('newBookingBtn').addEventListener('click', () => {
        if (!currentUser) {
            alert('Devi effettuare il login');
            return;
        }
        if (userAnimals.length === 0) {
            alert('Aggiungi prima un animale');
            document.getElementById('animalModal').classList.add('show');
            return;
        }
        openBookingModal();
    });

    document.getElementById('animalForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveAnimal();
    });

    document.getElementById('bookingForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createBooking();
    });
}

// Gestione Animali
async function loadAnimals() {
    if (!currentUser) return;

    try {
        const snapshot = await db.collection('animals')
            .where('userId', '==', currentUser.uid)
            .get();

        userAnimals = [];
        const animalsList = document.getElementById('animalsList');
        animalsList.innerHTML = '';

        snapshot.forEach(doc => {
            const animal = { id: doc.id, ...doc.data() };
            userAnimals.push(animal);
            
            const animalCard = document.createElement('div');
            animalCard.className = 'animal-card';
            animalCard.innerHTML = `
                <div>
                    <h4>${animal.name}</h4>
                    <p>${animal.type} - ${animal.breed || 'N/A'}</p>
                </div>
                <button class="btn btn-danger" onclick="deleteAnimal('${animal.id}')">Elimina</button>
            `;
            animalsList.appendChild(animalCard);
        });

        updateBookingAnimalSelect();
    } catch (error) {
        console.error('Errore nel caricamento animali:', error);
    }
}

function updateBookingAnimalSelect() {
    const select = document.getElementById('bookingAnimal');
    select.innerHTML = '<option value="">Seleziona animale</option>';
    
    userAnimals.forEach(animal => {
        const option = document.createElement('option');
        option.value = animal.id;
        option.textContent = `${animal.name} (${animal.type})`;
        select.appendChild(option);
    });
}

async function saveAnimal() {
    if (!currentUser) return;

    const animalData = {
        userId: currentUser.uid,
        name: document.getElementById('animalName').value,
        type: document.getElementById('animalType').value,
        breed: document.getElementById('animalBreed').value,
        birthDate: document.getElementById('animalBirthDate').value,
        notes: document.getElementById('animalNotes').value,
        createdAt: getTimestamp()
    };

    try {
        await db.collection('animals').add(animalData);
        document.getElementById('animalForm').reset();
        loadAnimals();
        alert('Animale salvato con successo!');
    } catch (error) {
        alert('Errore nel salvataggio: ' + error.message);
    }
}

async function deleteAnimal(animalId) {
    if (!confirm('Sei sicuro di voler eliminare questo animale?')) return;

    try {
        await db.collection('animals').doc(animalId).delete();
        loadAnimals();
    } catch (error) {
        alert('Errore nell\'eliminazione: ' + error.message);
    }
}

// Gestione Prenotazioni
function openBookingModal(dateStr = null) {
    const modal = document.getElementById('bookingModal');
    const dateTimeInput = document.getElementById('bookingDateTime');
    
    if (dateStr) {
        const date = new Date(dateStr);
        date.setHours(10, 0, 0, 0);
        dateTimeInput.value = date.toISOString().slice(0, 16);
    } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(10, 0, 0, 0);
        dateTimeInput.value = tomorrow.toISOString().slice(0, 16);
    }

    modal.classList.add('show');
}

async function createBooking() {
    if (!currentUser) return;

    const animalId = document.getElementById('bookingAnimal').value;
    const service = document.getElementById('bookingService').value;
    const dateTime = document.getElementById('bookingDateTime').value;
    const notes = document.getElementById('bookingNotes').value;
    const paymentMethod = document.querySelector('input[name="payment"]:checked').value;

    const animal = userAnimals.find(a => a.id === animalId);
    if (!animal) {
        alert('Seleziona un animale');
        return;
    }

    const bookingData = {
        userId: currentUser.uid,
        userEmail: currentUser.email,
        animalId: animalId,
        animalName: animal.name,
        animalType: animal.type,
        service: service,
        dateTime: firebase.firestore.Timestamp.fromDate(new Date(dateTime)),
        notes: notes,
        paymentMethod: paymentMethod,
        status: 'pending',
        createdAt: getTimestamp()
    };

    try {
        const docRef = await db.collection('bookings').add(bookingData);
        
        // Invia notifica (non bloccare se fallisce)
        try {
            await sendBookingNotification(bookingData, docRef.id);
        } catch (notifError) {
            console.warn('Errore nell\'invio notifica:', notifError);
        }
        
        // Se pagamento online, gestisci pagamento (non bloccare se fallisce)
        if (paymentMethod === 'online') {
            try {
                await handleOnlinePayment(docRef.id, bookingData);
            } catch (paymentError) {
                console.warn('Errore nella gestione pagamento:', paymentError);
            }
        }

        document.getElementById('bookingForm').reset();
        document.getElementById('bookingModal').classList.remove('show');
        
        alert('Prenotazione creata con successo!');
        
        // Ricarica i dati (non bloccare se fallisce)
        try {
            loadBookings();
            loadCalendarEvents();
        } catch (loadError) {
            console.warn('Errore nel ricaricamento dati:', loadError);
        }
    } catch (error) {
        console.error('Errore nella creazione della prenotazione:', error);
        alert('Errore nella creazione della prenotazione: ' + error.message);
    }
}

async function loadBookings() {
    if (!currentUser) return;

    try {
        const snapshot = await db.collection('bookings')
            .where('userId', '==', currentUser.uid)
            .orderBy('dateTime', 'desc')
            .get();

        const bookingsList = document.getElementById('bookingsList');
        bookingsList.innerHTML = '';

        if (snapshot.empty) {
            bookingsList.innerHTML = '<p>Nessuna prenotazione trovata</p>';
            return;
        }

        snapshot.forEach(doc => {
            const booking = { id: doc.id, ...doc.data() };
            const bookingCard = createBookingCard(booking);
            bookingsList.appendChild(bookingCard);
        });
    } catch (error) {
        console.error('Errore nel caricamento prenotazioni:', error);
    }
}

function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = `booking-card ${booking.status}`;
    
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
            <h4>${booking.animalName} - ${serviceNames[booking.service] || booking.service}</h4>
            <span class="booking-status ${booking.status}">${booking.status}</span>
        </div>
        <p><strong>Data:</strong> ${date.toLocaleString('it-IT')}</p>
        <p><strong>Pagamento:</strong> ${booking.paymentMethod === 'online' ? 'Online' : 'In Presenza'}</p>
        ${booking.notes ? `<p><strong>Note:</strong> ${booking.notes}</p>` : ''}
    `;

    return card;
}

async function loadCalendarEvents() {
    if (!currentUser || !calendar) return;

    try {
        const snapshot = await db.collection('bookings')
            .where('userId', '==', currentUser.uid)
            .where('status', 'in', ['pending', 'confirmed'])
            .get();

        const events = [];
        snapshot.forEach(doc => {
            const booking = doc.data();
            const date = timestampToDate(booking.dateTime);
            
            events.push({
                id: doc.id,
                title: `${booking.animalName} - ${booking.service}`,
                start: date.toISOString(),
                backgroundColor: booking.status === 'confirmed' ? '#50c878' : '#f39c12'
            });
        });

        if (calendar && typeof calendar.removeAllEvents === 'function') {
            calendar.removeAllEvents();
            calendar.addEventSource(events);
        }
    } catch (error) {
        console.error('Errore nel caricamento eventi calendario:', error);
    }
}

function showBookingDetails(event) {
    // Implementazione dettagli prenotazione
    console.log('Dettagli prenotazione:', event);
}

function loadUserData() {
    loadAnimals();
    loadBookings();
    loadCalendarEvents();
}

// Notifiche (da implementare con EmailJS)
async function sendBookingNotification(bookingData, bookingId) {
    if (typeof window.sendBookingNotification === 'function') {
        await window.sendBookingNotification(bookingData, bookingId);
    } else {
        console.log('Invio notifica per prenotazione:', bookingId);
    }
}

// Pagamenti (da implementare con Stripe)
async function handleOnlinePayment(bookingId, bookingData) {
    if (typeof window.handleOnlinePayment === 'function') {
        await window.handleOnlinePayment(bookingId, bookingData);
    } else {
        console.log('Gestione pagamento online per:', bookingId);
    }
}


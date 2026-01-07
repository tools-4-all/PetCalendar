# Configurazione Firestore Rules

## Come applicare le regole di sicurezza Firestore

1. **Vai alla Firebase Console**
   - Apri [Firebase Console](https://console.firebase.google.com/)
   - Seleziona il progetto `petcalendar-67853`

2. **Apri Firestore Database**
   - Nel menu laterale, clicca su **Firestore Database**
   - Vai al tab **Rules** (in alto)

3. **Copia le regole**
   - Apri il file `firestore.rules` in questo progetto
   - Copia tutto il contenuto

4. **Incolla le regole**
   - Incolla il contenuto nell'editor delle regole nella Firebase Console
   - Clicca su **Pubblica** (Publish)

## Cosa fanno queste regole

### Collection `animals`
- ✅ Solo il proprietario può leggere i propri animali
- ✅ Solo il proprietario può creare animali per se stesso
- ✅ Solo il proprietario può modificare/eliminare i propri animali

### Collection `bookings`
- ✅ I clienti possono leggere solo le proprie prenotazioni
- ✅ I clienti possono creare prenotazioni solo per se stessi
- ✅ Gli admin possono leggere tutte le prenotazioni (tutti gli utenti autenticati)
- ✅ Gli admin possono aggiornare tutte le prenotazioni (per cambiare lo status)
- ✅ Solo il proprietario può eliminare le proprie prenotazioni

## Nota sulla sicurezza

Le regole attuali permettono a tutti gli utenti autenticati di leggere e aggiornare le prenotazioni. Questo è necessario perché l'area admin deve vedere tutte le prenotazioni.

**Per maggiore sicurezza in produzione**, considera di:
1. Usare Firebase Custom Claims per distinguere admin da clienti
2. Modificare le regole per verificare il claim `admin` prima di permettere accesso completo

Esempio con custom claims:
```javascript
// Nelle regole, invece di `true`, usa:
request.auth.token.admin == true
```

## Test delle regole

Dopo aver pubblicato le regole, puoi testarle usando:
- Firebase Console > Firestore > Rules > Simulator
- Oppure testa direttamente l'applicazione


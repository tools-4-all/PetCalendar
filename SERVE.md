# Come vedere il sito su localhost

## Opzione 1: Python (Raccomandato)
```bash
cd /Users/niccologatti/Desktop/PetCalendar
python3 -m http.server 8000
```
Poi apri: http://localhost:8000

## Opzione 2: Node.js (se hai Node installato)
```bash
# Installa http-server globalmente (una volta sola)
npm install -g http-server

# Avvia il server
cd /Users/niccologatti/Desktop/PetCalendar
http-server -p 8000
```

## Opzione 3: PHP (se hai PHP installato)
```bash
cd /Users/niccologatti/Desktop/PetCalendar
php -S localhost:8000
```

## Opzione 4: VS Code Live Server
Se usi VS Code, installa l'estensione "Live Server" e clicca con il tasto destro su `index.html` > "Open with Live Server"

## Nota Importante
⚠️ **Non aprire direttamente i file HTML** (doppio click) perché Firebase richiede un server HTTP per funzionare correttamente a causa delle policy CORS.


# System Monitorowania i Zarządzania Urządzeniami Przemysłowymi

## Wprowadzenie

**Nazwa Projektu**: System Monitorowania i Zarządzania Urządzeniami Przemysłowymi

**Cel Projektu**: Umożliwienie monitorowania urządzeń przemysłowych oraz zarządzanie nimi za pomocą technologii OPC UA i Azure IoT. System zapewnia automatyczne wysyłanie powiadomień o błędach oraz kontrolę nad produkcją.

## Instrukcja Uruchomienia

### Wymagania Wstępne

- Komputer z zainstalowanym Node.js (wersja 14 lub wyższa)
- Dostęp do Internetu
- Konto Azure z dostępem do IoT Hub i Azure Communication Services

### Instalacja i Konfiguracja

1. **Pobierz i Zainstaluj Program**:

   - Upewnij się, że masz zainstalowany Node.js. Jeśli nie, pobierz go z [nodejs.org](https://nodejs.org/).
   - Pobierz program z repozytorium (link do repozytorium podany przez prowadzącego).

2. **Zainstaluj Wymagane Pakiety**:

   - Otwórz terminal (lub wiersz poleceń) i przejdź do folderu z pobranym programem.
   - Wpisz polecenie:
     ```bash
     npm install
     ```

3. **Skonfiguruj Połączenie z Azure i OPC UA**:
   - Skonfiguruj plik konfiguracyjny z danymi połączenia do serwera OPC UA oraz Azure IoT Hub (instrukcja znajduje się w repozytorium).

### Uruchomienie Programu

1. **Uruchom Program**:
   - W terminalu (lub wiersz poleceń) wpisz:
     ```bash
     ts-node src/index.ts
     ```
   - Program rozpocznie monitorowanie urządzeń i przesyłanie danych do Azure IoT Hub.

## Monitorowanie Urządzeń

### Odczyt Danych

- Program automatycznie odczytuje dane z urządzeń przemysłowych co 1 sekundę. Dane obejmują:
  - Temperaturę
  - Tempo produkcji
  - Liczbę dobrych i złych produktów
  - Status produkcji
  - Identyfikator zamówienia
  - Błędy urządzeń

### Wysyłanie Danych

- Dane są wysyłane do Azure IoT Hub w czasie rzeczywistym, co pozwala na bieżące monitorowanie stanu urządzeń.

## Powiadomienia o Błędach

### Automatyczne Powiadomienia

- Jeśli urządzenie wykryje błąd, program automatycznie wysyła powiadomienie email do zdefiniowanego odbiorcy.

### Przykładowe Powiadomienie

**Treść Emaila**:

- Temat: Powiadomienie o błędzie urządzenia
- Treść: "Urządzenie [deviceId] napotkało błąd o kodzie [errorCode]."

## Zarządzanie Urządzeniami

### Metody Zarządzania

- Program umożliwia zarządzanie urządzeniami za pomocą tzw. Direct Methods, które można wywołać z platformy Azure IoT. Dostępne metody to m.in.:
  - **EmergencyStop**: Natychmiastowe zatrzymanie urządzenia w sytuacji awaryjnej.
  - **ResetErrorStatus**: Resetowanie statusu błędu urządzenia.

### Przykładowe Scenariusze

- **Zatrzymanie Awaryjne**: W przypadku wykrycia krytycznego błędu (kod błędu 14), program automatycznie wykonuje polecenie zatrzymania awaryjnego urządzenia.
- **Kontrola Produkcji**: Jeśli jakość produkcji spadnie poniżej 90%, program automatycznie zmniejszy tempo produkcji.

## Podsumowanie

Dokumentacja opisuje sposób uruchomienia i korzystania z aplikacji do monitorowania i zarządzania urządzeniami przemysłowymi. Zawiera instrukcje krok po kroku oraz opis głównych funkcjonalności systemu.

Jeśli potrzebujesz dodatkowej pomocy lub masz pytania, skontaktuj się z prowadzącym zajęcia lub zapoznaj się z instrukcjami dostępnymi w repozytorium projektu.

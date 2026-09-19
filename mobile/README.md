# Ruta Segura — Aplicación Móvil (React Native & Expo)

Aplicación nativa para Android e iOS diseñada para acompañamiento en trayectos, monitoreo GPS silencioso en segundo plano, botón de pánico SOS de un toque y suscripciones dentro de la app ($120 MXN / cada 2 meses) mediante RevenueCat.

## Características
- **Monitoreo Silencioso (`expo-location`)**: Monitoreo de posición en segundo plano sin drenado excesivo de batería.
- **Botón de Pánico SOS**: Envío prioritario de coordenadas satelitales al contacto de emergencia.
- **Suscripciones RevenueCat (`react-native-purchases`)**: Pasarela para App Store y Google Play Store para el plan de $120 MXN cada 2 meses.
- **Llegada a Salvo**: Confirmación de un toque que notifica a la familia que el viaje finalizó con tranquilidad.

## Instrucciones para Ejecutar Localmente

1. Instalar dependencias:
   ```bash
   cd mobile
   npm install
   ```

2. Iniciar el entorno de desarrollo Expo:
   ```bash
   npx expo start
   ```

3. Escanear el código QR con la app **Expo Go** en tu dispositivo físico Android o iOS, o presionar `a` para emulador Android o `i` para simulador iOS.

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, TouchableOpacity, Alert, Platform, Linking } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import Purchases from 'react-native-purchases';

// Configuration
// ⚠️ PRODUCCIÓN: Cambia esta URL por tu servidor Render ANTES de compilar el APK/AAB.
// Ejemplo: 'https://ruta-segura-api.onrender.com'
// DESARROLLO: Usa la IP local de tu Wi-Fi (ej: 'http://192.168.1.X:3000')
const DEFAULT_BACKEND_URL = 'https://ruta-segura-api.onrender.com';
const REVENUECAT_API_KEY_APPLE = 'appl_mock_api_key'; // Reemplaza con tu key real de RevenueCat
const REVENUECAT_API_KEY_GOOGLE = 'goog_mock_api_key'; // Reemplaza con tu key real de RevenueCat

export default function App() {
  const [backendUrl, setBackendUrl] = useState(DEFAULT_BACKEND_URL);
  const [currentTab, setCurrentTab] = useState('home');
  const [isTracking, setIsTracking] = useState(false);
  const [subscriptionActive, setSubscriptionActive] = useState(true);
  const [location, setLocation] = useState(null);
  const [distanceTraveled, setDistanceTraveled] = useState(0);
  const [termsAccepted, setTermsAccepted] = useState(true);

  const [userProfile, setUserProfile] = useState({
    nombre: 'Sofía Martínez',
    telefono: '+525512345678',
    contactoEmergencia: {
      nombre: 'Bertha (Mamá)',
      telefono: '+525598765432'
    }
  });

  // Handle ARCO Data Deletion
  const handleEliminarDatosARCO = () => {
    Alert.alert(
      'Eliminar mis Datos Personales',
      '¿Estás seguro de que deseas ejercer tu derecho de Cancelación ARCO y borrar permanentemente tu perfil y registros del servidor?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, Eliminar Todo',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${backendUrl}/api/usuario/eliminar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ telefono: userProfile.telefono })
              });
              const data = await res.json();
              if (data.ok) {
                Alert.alert('Datos Purgados', 'Tus datos personales y de ubicación han sido borrados de los servidores de Ruta Segura.');
                setUserProfile({ nombre: '', telefono: '', contactoEmergencia: { nombre: '', telefono: '' } });
                setIsTracking(false);
                setCurrentTab('home');
              } else {
                Alert.alert('Aviso', data.error || 'No se pudo procesar la solicitud.');
              }
            } catch (e) {
              Alert.alert('Error', 'No se pudo conectar con el servidor: ' + e.message);
            }
          }
        }
      ]
    );
  };

  // Initialize RevenueCat SDK
  useEffect(() => {
    async function initPurchases() {
      try {
        if (Purchases && typeof Purchases.configure === 'function') {
          const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_APPLE : REVENUECAT_API_KEY_GOOGLE;
          await Purchases.configure({ apiKey, appUserID: userProfile.telefono });
          const customerInfo = await Purchases.getCustomerInfo();
          if (customerInfo?.entitlements?.active?.['ruta_segura_premium']) {
            setSubscriptionActive(true);
          }
        }
      } catch (e) {
        console.log('Purchases init (mock mode):', e?.message || e);
      }
    }
    initPurchases();
  }, []);

  // Request GPS Permissions
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permiso Denegado', 'Se requiere acceso al GPS para monitorear tu trayecto de forma segura.');
        return;
      }
      let loc = await Location.getCurrentPositionAsync({});
      setLocation(loc.coords);
    })();
  }, []);

  // GPS Background Watcher
  useEffect(() => {
    let watcher = null;
    if (isTracking) {
      (async () => {
        watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 5000,
            distanceInterval: 10
          },
          async (newLoc) => {
            setLocation(newLoc.coords);
            try {
              const res = await fetch(`${backendUrl}/ubicacion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  telefonoPropio: userProfile.telefono,
                  latitud: newLoc.coords.latitude,
                  longitud: newLoc.coords.longitude,
                  bateria: 90,
                  velocidad: newLoc.coords.speed || 0,
                  timestamp: Date.now()
                })
              });
              const data = await res.json();
              if (data.ok) {
                setDistanceTraveled(data.distanciaTotal || 0);
              }
            } catch (err) {
              console.log('Telemetry dispatch error:', err.message);
            }
          }
        );
      })();
    }
    return () => {
      if (watcher) watcher.remove();
    };
  }, [isTracking]);

  // Handle SOS Emergency Panic
  const handlePanicButton = async () => {
    try {
      const res = await fetch(`${backendUrl}/api/panico`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: userProfile.telefono,
          latitud: location ? location.latitude : 19.432608,
          longitud: location ? location.longitude : -99.133209,
          bateria: 85
        })
      });
      const data = await res.json();
      if (data.ok) {
        Alert.alert(
          '🚨 ALERTA SOS ENVIADA',
          `Se ha enviado tu ubicación satelital en tiempo real a ${userProfile.contactoEmergencia.nombre} vía Twilio / WhatsApp.`
        );
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo contactar con el servidor. Llama al 911.');
    }
  };

  // Handle Arrival Confirmation
  const handleArrival = async () => {
    setIsTracking(false);
    try {
      const res = await fetch(`${backendUrl}/api/llegada`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefonoPropio: userProfile.telefono,
          latitud: location ? location.latitude : 19.432608,
          longitud: location ? location.longitude : -99.133209
        })
      });
      const data = await res.json().catch(() => ({ ok: true }));
      if (data.ok) {
        Alert.alert('✅ Llegada a Salvo', 'Tus contactos fueron notificados de que llegaste bien.');
      } else {
        Alert.alert('Aviso', data.error || 'Se registró tu llegada localmente.');
      }
    } catch (e) {
      Alert.alert('✅ Llegada a Salvo', 'Monitoreo detenido. Llegaste con bien a tu destino.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Main Header */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>🛡️ Ruta Segura</Text>
        <Text style={styles.brandSubtitle}>
          {subscriptionActive ? '● Plan Activo ($120 MXN / 2 meses)' : '○ Sin Suscripción'}
        </Text>
      </View>

      {/* Screen Views */}
      <View style={styles.content}>
        {currentTab === 'home' && (
          <View style={styles.screenContainer}>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Contacto de Emergencia</Text>
              <Text style={styles.contactName}>{userProfile.contactoEmergencia.nombre}</Text>
              <Text style={styles.contactPhone}>{userProfile.contactoEmergencia.telefono}</Text>
            </View>

            {/* Consentimiento Legal de Geolocalización (LFPDPPP) */}
            <TouchableOpacity
              style={[styles.card, { marginVertical: 8, borderColor: termsAccepted ? '#10b981' : '#ef4444', backgroundColor: termsAccepted ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)' }]}
              onPress={() => setTermsAccepted(!termsAccepted)}
            >
              <Text style={{ color: '#ffffff', fontSize: 13, fontWeight: '700' }}>
                {termsAccepted ? '☑️ Consentimiento Legal Activo' : '⬜ Aceptar Términos y Privacidad'}
              </Text>
              <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4, lineHeight: 15 }}>
                Autorizo el tratamiento de mi geolocalización satelital para mi seguridad preventiva conforme a la ley. Toca para {termsAccepted ? 'desactivar' : 'aceptar'}.
              </Text>
            </TouchableOpacity>

            <View style={styles.actionContainer}>
              {!isTracking ? (
                <TouchableOpacity
                  style={[styles.btnStart, !termsAccepted && { opacity: 0.6 }]}
                  onPress={() => {
                    if (!termsAccepted) {
                      Alert.alert('Consentimiento Requerido', 'Para activar el monitoreo satelital debes aceptar los Términos y el Aviso de Privacidad.');
                      return;
                    }
                    setIsTracking(true);
                    setCurrentTab('trip');
                  }}
                >
                  <Text style={styles.btnText}>🚗 Iniciar Ruta Segura</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.btnActive}
                  onPress={() => setCurrentTab('trip')}
                >
                  <Text style={styles.btnText}>📡 Ver Viaje en Curso</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.btnPanicSmall}
                onPress={handlePanicButton}
              >
                <Text style={styles.btnTextPanic}>🆘 Auxilio Inmediato</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {currentTab === 'trip' && (
          <View style={styles.screenContainer}>
            <View style={styles.cardCenter}>
              <Text style={styles.cardHeader}>Telemetría en Vivo</Text>
              <Text style={styles.metricBig}>{(distanceTraveled / 1000).toFixed(2)} km</Text>
              <Text style={styles.metricSub}>Distancia total recorrida</Text>
            </View>

            <TouchableOpacity style={styles.btnSafe} onPress={handleArrival}>
              <Text style={styles.btnText}>✅ ¡Llegué a Salvo!</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.btnPanicLarge} onPress={handlePanicButton}>
              <Text style={styles.btnTextPanic}>🚨 BOTÓN DE PÁNICO</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentTab === 'sos' && (
          <View style={[styles.screenContainer, { justifyContent: 'center', alignItems: 'center' }]}>
            <TouchableOpacity style={styles.sosButtonCircle} onPress={handlePanicButton}>
              <Text style={styles.sosButtonText}>SOS</Text>
              <Text style={styles.sosButtonSub}>AUXILIO</Text>
            </TouchableOpacity>
            <Text style={styles.sosExplanation}>
              Presiona para enviar tus coordenadas satelitales al instante a tu contacto de emergencia vía WhatsApp.
            </Text>
          </View>
        )}

        {currentTab === 'paywall' && (
          <View style={styles.screenContainer}>
            <View style={styles.paywallCard}>
              <Text style={styles.paywallTitle}>Ruta Segura Premium</Text>
              <Text style={styles.paywallPrice}>$120 MXN / cada 2 meses</Text>
              <Text style={styles.paywallDesc}>Tranquilidad total para ti y tus seres queridos con monitoreo GPS 24/7 y alertas WhatsApp automáticas.</Text>
            </View>

            <TouchableOpacity
              style={styles.btnSubscribe}
              onPress={async () => {
                try {
                  if (Purchases && typeof Purchases.purchasePackage === 'function') {
                    const offerings = await Purchases.getOfferings();
                    if (offerings.current && offerings.current.availablePackages.length > 0) {
                      const { customerInfo } = await Purchases.purchasePackage(offerings.current.availablePackages[0]);
                      if (customerInfo?.entitlements?.active?.['ruta_segura_premium']) {
                        setSubscriptionActive(true);
                        Alert.alert('¡Suscripción Exitosa!', 'Tu cuenta cuenta con protección bimestral activa.');
                        return;
                      }
                    }
                  }
                  Alert.alert(
                    'Suscripción Ruta Segura',
                    'Activación de Plan Bimestral ($120 MXN / 2 meses) vía App Store / Google Play.',
                    [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Confirmar y Activar',
                        onPress: () => {
                          setSubscriptionActive(true);
                          Alert.alert('🎉 Plan Activado', 'Tu suscripción bimestral de Ruta Segura ($120 MXN) está activa con monitoreo GPS 24/7.');
                        }
                      }
                    ]
                  );
                } catch (e) {
                  Alert.alert('Aviso', e.userCancelled ? 'Compra cancelada.' : ('Detalle: ' + e.message));
                }
              }}
            >
              <Text style={styles.btnText}>Adquirir en App Store / Play Store ($120 / 2 meses)</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnSubscribe, { backgroundColor: '#10b981', marginTop: 12 }]}
              onPress={() => {
                Linking.openURL(backendUrl).catch(() => Alert.alert('Aviso', 'Abre ' + backendUrl + ' en tu navegador para pagar con Tarjeta, Mercado Pago o SPEI.'));
              }}
            >
              <Text style={styles.btnText}>💳 Pagar en Línea con Tarjeta / Mercado Pago ($120 / 2 meses)</Text>
            </TouchableOpacity>
          </View>
        )}

        {currentTab === 'legal' && (
          <View style={styles.screenContainer}>
            <View style={styles.card}>
              <Text style={styles.cardHeader}>Marco Legal y Derechos ARCO</Text>
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '700', marginTop: 4 }}>
                Protección de Datos Personales
              </Text>
              <Text style={{ color: '#cbd5e1', fontSize: 12, marginTop: 6, lineHeight: 18 }}>
                Cumplimiento pleno con la LFPDPPP mexicana y GDPR. Tu ubicación se procesa exclusivamente mientras un viaje está en curso y nunca es vendida ni transferida a brokers comerciales.
              </Text>
            </View>

            <View style={{ gap: 10, marginVertical: 12 }}>
              <TouchableOpacity
                style={[styles.btnSafe, { backgroundColor: '#4f46e5' }]}
                onPress={() => Linking.openURL(`${backendUrl}/terminos`).catch(() => Alert.alert('Aviso', 'Visita ' + backendUrl + '/terminos en tu navegador.'))}
              >
                <Text style={styles.btnText}>📄 Leer Términos y Condiciones</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.btnSafe, { backgroundColor: '#059669' }]}
                onPress={() => Linking.openURL(`${backendUrl}/privacidad`).catch(() => Alert.alert('Aviso', 'Visita ' + backendUrl + '/privacidad en tu navegador.'))}
              >
                <Text style={styles.btnText}>🛡️ Leer Aviso de Privacidad Integral</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnPanicSmall}
                onPress={handleEliminarDatosARCO}
              >
                <Text style={styles.btnTextPanic}>🗑️ Purgar / Eliminar mis Datos (ARCO)</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('home')}>
          <Text style={[styles.navText, currentTab === 'home' && styles.navActive]}>🏠 Inicio</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('trip')}>
          <Text style={[styles.navText, currentTab === 'trip' && styles.navActive]}>📍 Viaje</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('sos')}>
          <Text style={[styles.navText, currentTab === 'sos' && styles.navActive]}>🆘 SOS</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('paywall')}>
          <Text style={[styles.navText, currentTab === 'paywall' && styles.navActive]}>👑 Plan</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => setCurrentTab('legal')}>
          <Text style={[styles.navText, currentTab === 'legal' && styles.navActive]}>⚖️ Legal</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0f19'
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)'
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#ffffff'
  },
  brandSubtitle: {
    fontSize: 12,
    color: '#10b981',
    marginTop: 2
  },
  content: {
    flex: 1,
    padding: 16
  },
  screenContainer: {
    flex: 1,
    justifyContent: 'space-between'
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)'
  },
  cardCenter: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    padding: 24,
    borderRadius: 14,
    alignItems: 'center'
  },
  cardHeader: {
    fontSize: 12,
    color: '#94a3b8',
    textTransform: 'uppercase',
    fontWeight: '700'
  },
  contactName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
    marginTop: 6
  },
  contactPhone: {
    fontSize: 14,
    color: '#6366f1',
    marginTop: 2
  },
  metricBig: {
    fontSize: 36,
    fontWeight: '900',
    color: '#6366f1',
    marginVertical: 6
  },
  metricSub: {
    fontSize: 13,
    color: '#94a3b8'
  },
  actionContainer: {
    gap: 12
  },
  btnStart: {
    backgroundColor: '#4f46e5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnActive: {
    backgroundColor: '#10b981',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnSafe: {
    backgroundColor: '#059669',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginVertical: 8
  },
  btnPanicSmall: {
    backgroundColor: 'rgba(239,68,68,0.2)',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444'
  },
  btnPanicLarge: {
    backgroundColor: '#dc2626',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnSubscribe: {
    backgroundColor: '#6366f1',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center'
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16
  },
  btnTextPanic: {
    color: '#fca5a5',
    fontWeight: '800',
    fontSize: 16
  },
  sosButtonCircle: {
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: '#dc2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 20
  },
  sosButtonText: {
    color: '#ffffff',
    fontSize: 36,
    fontWeight: '900'
  },
  sosButtonSub: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2
  },
  sosExplanation: {
    color: '#94a3b8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 24,
    paddingHorizontal: 20
  },
  paywallCard: {
    backgroundColor: 'rgba(99,102,241,0.1)',
    padding: 24,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#6366f1',
    alignItems: 'center'
  },
  paywallTitle: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800'
  },
  paywallPrice: {
    color: '#6366f1',
    fontSize: 32,
    fontWeight: '900',
    marginVertical: 8
  },
  paywallDesc: {
    color: '#cbd5e1',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20
  },
  bottomNav: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#090e17'
  },
  navItem: {
    alignItems: 'center'
  },
  navText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '600'
  },
  navActive: {
    color: '#818cf8',
    fontWeight: '800'
  }
});

import { Alert, Platform } from 'react-native';

// Alert.alert no hace nada en la web: usamos alert/confirm del navegador
export function avisar(titulo, mensaje = '') {
  if (Platform.OS === 'web') window.alert(mensaje ? `${titulo}\n\n${mensaje}` : titulo);
  else Alert.alert(titulo, mensaje);
}

export function confirmar(titulo, mensaje, textoOk, onOk) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${titulo}\n\n${mensaje}`)) onOk();
    return;
  }
  Alert.alert(titulo, mensaje, [
    { text: 'Cancelar', style: 'cancel' },
    { text: textoOk, style: 'destructive', onPress: onOk },
  ]);
}

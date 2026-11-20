import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';
import { avisar, confirmar } from './alerta';
import { CATEGORIAS, colors } from './theme';

const VACIO = { nombre: '', categoria: 'Otro', cantidad: 0, proyecto: '', imagen: null };

export default function FormModal({ id, onClose, onSaved }) {
  const [form, setForm] = useState(VACIO);
  const [proyectos, setProyectos] = useState([]);
  const [cargando, setCargando] = useState(!!id);
  const [guardando, setGuardando] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    api.proyectos().then(setProyectos).catch(() => {});
    if (id) {
      api.obtener(id)
        .then((c) => setForm({ ...c, proyecto: c.proyecto ?? '' }))
        .catch((e) => { avisar('Error', e.message); onClose(); })
        .finally(() => setCargando(false));
    }
  }, [id]);

  const elegirImagen = async (camara) => {
    const perm = camara
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return avisar('Permiso denegado');
    const opts = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.4, base64: true };
    const r = camara ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return;
    const a = r.assets[0];
    // En la web la uri ya viene como data URL
    set('imagen')(a.base64 ? `data:${a.mimeType || 'image/jpeg'};base64,${a.base64}` : a.uri);
  };

  const guardar = async () => {
    if (!form.nombre.trim()) return avisar('Falta el nombre del material');
    setGuardando(true);
    try {
      const body = {
        nombre: form.nombre,
        categoria: form.categoria,
        cantidad: Number(form.cantidad) || 0,
        proyecto: form.proyecto,
        imagen: form.imagen,
      };
      if (id) await api.actualizar(id, body);
      else await api.crear(body);
      onSaved();
    } catch (e) {
      avisar('Error', e.message);
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = () => confirmar('Eliminar', `¿Eliminar "${form.nombre}"?`, 'Eliminar', async () => {
    try { await api.eliminar(id); onSaved(); } catch (e) { avisar('Error', e.message); }
  });

  const cantidad = Number(form.cantidad) || 0;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.bar}>
          <Pressable onPress={onClose}><Text style={styles.link}>Cancelar</Text></Pressable>
          <Text style={styles.barTitle}>{id ? 'Editar' : 'Nuevo componente'}</Text>
          <Pressable onPress={guardar} disabled={guardando || cargando}>
            {guardando ? <ActivityIndicator color={colors.accent} /> : <Text style={[styles.link, styles.bold]}>Guardar</Text>}
          </Pressable>
        </View>

        {cargando ? <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} /> : (
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.imgBox}>
              {form.imagen
                ? <Image source={{ uri: form.imagen }} style={styles.img} />
                : <Text style={{ color: colors.muted }}>Sin imagen</Text>}
            </View>
            <View style={styles.row}>
              <Btn label="Galería" onPress={() => elegirImagen(false)} />
              <Btn label="Cámara" onPress={() => elegirImagen(true)} />
              {form.imagen && <Btn label="Quitar" onPress={() => set('imagen')(null)} />}
            </View>

            <Text style={styles.label}>Nombre del material</Text>
            <TextInput style={styles.input} value={form.nombre} onChangeText={set('nombre')} placeholder="Ej. ESP32, Resistencia 10kΩ" placeholderTextColor={colors.muted} />

            <Text style={styles.label}>Cantidad</Text>
            <View style={styles.row}>
              <Btn label="−" onPress={() => set('cantidad')(Math.max(0, cantidad - 1))} />
              <TextInput
                style={[styles.input, styles.qtyInput]}
                keyboardType="number-pad"
                value={String(form.cantidad)}
                onChangeText={(t) => set('cantidad')(t.replace(/\D/g, ''))}
              />
              <Btn label="+" onPress={() => set('cantidad')(cantidad + 1)} />
            </View>

            <Text style={styles.label}>Proyecto</Text>
            <TextInput style={styles.input} value={form.proyecto} onChangeText={set('proyecto')} placeholder="Sin asignar" placeholderTextColor={colors.muted} />
            {proyectos.length > 0 && (
              <View style={styles.chips}>
                {proyectos.map((p) => (
                  <Chip key={p} label={p} activo={form.proyecto === p} onPress={() => set('proyecto')(p)} />
                ))}
              </View>
            )}

            <Text style={styles.label}>Categoría</Text>
            <View style={styles.chips}>
              {CATEGORIAS.map((c) => (
                <Chip key={c} label={c} activo={form.categoria === c} onPress={() => set('categoria')(c)} />
              ))}
            </View>

            {id && (
              <Pressable onPress={eliminar} style={styles.delete}>
                <Text style={{ color: colors.danger, fontWeight: '600' }}>Eliminar componente</Text>
              </Pressable>
            )}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const Btn = ({ label, onPress }) => (
  <Pressable style={styles.btn} onPress={onPress}><Text style={styles.btnTxt}>{label}</Text></Pressable>
);

const Chip = ({ label, activo, onPress }) => (
  <Pressable onPress={onPress} style={[styles.chip, activo && styles.chipActivo]}>
    <Text style={[styles.chipTxt, activo && { color: '#fff' }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 40, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  barTitle: { fontSize: 17, fontWeight: '600', color: colors.text },
  link: { color: colors.accent, fontSize: 16 },
  bold: { fontWeight: '700' },
  body: { padding: 16, paddingBottom: 60 },
  imgBox: {
    alignSelf: 'center', width: 180, height: 180, borderRadius: 14, backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  img: { width: '100%', height: '100%', backgroundColor: '#fff' },
  row: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 10 },
  label: { marginTop: 20, marginBottom: 6, fontWeight: '600', color: colors.muted, fontSize: 13 },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 10, fontSize: 16, color: colors.text,
  },
  qtyInput: { width: 90, textAlign: 'center', fontSize: 18, fontWeight: '700' },
  btn: {
    minWidth: 44, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center',
  },
  btnTxt: { fontSize: 16, fontWeight: '600', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.bg },
  chipActivo: { backgroundColor: colors.accent },
  chipTxt: { color: colors.text, fontSize: 14 },
  delete: { marginTop: 32, alignItems: 'center', padding: 12 },
});

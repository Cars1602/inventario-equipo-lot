import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, FlatList, Image, Platform, Pressable, StatusBar as RNStatusBar,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { api } from './src/api';
import { avisar } from './src/alerta';
import FormModal from './src/FormModal';
import { colors } from './src/theme';

export default function App() {
  const [items, setItems] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null); // null = cerrado, {} = nuevo, {id} = editar
  const [imgVersion, setImgVersion] = useState(0);

  const cargar = useCallback(async () => {
    try {
      setItems(await api.listar(busqueda.trim()));
    } catch (e) {
      avisar('Sin conexión', `No se pudo conectar con el servidor.\n${e.message}`);
    } finally {
      setCargando(false);
    }
  }, [busqueda]);

  useEffect(() => {
    const t = setTimeout(cargar, 300);
    return () => clearTimeout(t);
  }, [cargar]);

  const ajustar = async (id, delta) => {
    try {
      const upd = await api.ajustar(id, delta);
      setItems((prev) => prev.map((x) => (x.id === id ? upd : x)));
    } catch (e) {
      avisar('Error', e.message);
    }
  };

  const alGuardar = () => {
    setEditando(null);
    setImgVersion((v) => v + 1);
    cargar();
  };

  const totalUnidades = items.reduce((s, x) => s + x.cantidad, 0);

  return (
    <View style={styles.screen}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <Text style={styles.title}>Inventario</Text>
        <Text style={styles.subtitle}>{items.length} componentes · {totalUnidades} unidades</Text>
        <TextInput
          style={styles.search}
          placeholder="Buscar componente…"
          placeholderTextColor={colors.muted}
          value={busqueda}
          onChangeText={setBusqueda}
        />
      </View>

      {cargando ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.accent} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(x) => String(x.id)}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          onRefresh={cargar}
          refreshing={false}
          ListEmptyComponent={<Text style={styles.empty}>Sin componentes. Toca + para agregar.</Text>}
          renderItem={({ item }) => (
            <Pressable style={styles.card} onPress={() => setEditando({ id: item.id })}>
              {item.tiene_imagen ? (
                <Image source={{ uri: api.imagenUrl(item.id, imgVersion) }} style={styles.thumb} />
              ) : (
                <View style={[styles.thumb, styles.thumbVacio]}>
                  <Text style={styles.thumbTxt}>{item.nombre.slice(0, 2).toUpperCase()}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {item.categoria}{item.proyecto ? ` · ${item.proyecto}` : ''}
                </Text>
              </View>
              <View style={styles.qtyBox}>
                <Pressable style={styles.qtyBtn} onPress={() => ajustar(item.id, -1)} hitSlop={6}>
                  <Text style={styles.qtyBtnTxt}>−</Text>
                </Pressable>
                <Text style={[styles.qty, item.cantidad === 0 && { color: colors.danger }]}>{item.cantidad}</Text>
                <Pressable style={styles.qtyBtn} onPress={() => ajustar(item.id, 1)} hitSlop={6}>
                  <Text style={styles.qtyBtnTxt}>+</Text>
                </Pressable>
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={() => setEditando({})}>
        <Text style={styles.fabTxt}>+</Text>
      </Pressable>

      {editando && <FormModal id={editando.id} onClose={() => setEditando(null)} onSaved={alGuardar} />}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingTop: Platform.OS === 'android' ? (RNStatusBar.currentHeight ?? 24) + 12 : 60,
    paddingHorizontal: 16, paddingBottom: 12, backgroundColor: colors.surface,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  title: { fontSize: 26, fontWeight: '700', color: colors.text },
  subtitle: { color: colors.muted, marginTop: 2, marginBottom: 12 },
  search: {
    backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 16, color: colors.text,
  },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: '#fff' },
  thumbVacio: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  thumbTxt: { color: colors.muted, fontWeight: '700', fontSize: 18 },
  nombre: { fontSize: 16, fontWeight: '600', color: colors.text },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyBtnTxt: { fontSize: 18, fontWeight: '700', color: colors.text },
  qty: { minWidth: 32, textAlign: 'center', fontSize: 17, fontWeight: '700', color: colors.text },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 40 },
  fab: {
    position: 'absolute', right: 20, bottom: 30, width: 60, height: 60, borderRadius: 30,
    backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', elevation: 4,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
  },
  fabTxt: { color: '#fff', fontSize: 32, lineHeight: 34 },
});

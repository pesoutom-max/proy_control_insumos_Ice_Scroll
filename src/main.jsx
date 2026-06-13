import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  ClipboardList,
  Download,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import {
  addMovimiento,
  deleteProducto,
  seedDefaultProducts,
  updateProducto,
  useFirebaseData,
} from "./services/firebase";
import { DEFAULT_PRODUCTS, CATEGORIAS, PROVEEDORES, RESPONSABLES, TIPOS_MOV } from "./data/defaultProducts";
import "./styles.css";

const money = (value) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);

const today = () => new Date().toISOString().slice(0, 10);

function stockFor(producto, movimientos) {
  return movimientos
    .filter((mov) => mov.productoId === producto.id)
    .reduce((stock, mov) => {
      const qty = Number(mov.cantidad) || 0;
      return ["Entrada", "Ajuste +"].includes(mov.tipo) ? stock + qty : stock - qty;
    }, Number(producto.stockInicial) || 0);
}

function estadoProducto(stock, minimo, objetivo) {
  if ((Number(minimo) || 0) === 0 && (Number(objetivo) || 0) === 0) return "Definir mínimo";
  if (stock <= 0) return "Sin stock";
  if (stock < Number(minimo || 0)) return "Reponer";
  return "OK";
}

function App() {
  const { productos, movimientos, loadingData, firebaseReady, error } = useFirebaseData();
  const [tab, setTab] = useState("panel");

  const stockMap = useMemo(() => {
    const map = {};
    productos.forEach((producto) => {
      map[producto.id] = stockFor(producto, movimientos);
    });
    return map;
  }, [productos, movimientos]);

  if (!firebaseReady) return <SetupScreen />;

  const tabs = [
    { id: "panel", label: "Panel", icon: Boxes },
    { id: "productos", label: "Productos", icon: ClipboardList },
    { id: "movimientos", label: "Movimientos", icon: PackagePlus },
    { id: "reposicion", label: "Reposición", icon: ShoppingCart },
  ];

  return (
    <Shell>
      <nav className="tabs" aria-label="Secciones">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button className={tab === id ? "tab active" : "tab"} key={id} onClick={() => setTab(id)}>
            <Icon size={17} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {error && <div className="notice danger">{error}</div>}

      {loadingData ? (
        <EmptyState title="Sincronizando datos" />
      ) : productos.length === 0 ? (
        <SeedScreen />
      ) : (
        <>
          {tab === "panel" && <Panel productos={productos} movimientos={movimientos} stockMap={stockMap} />}
          {tab === "productos" && <Productos productos={productos} stockMap={stockMap} />}
          {tab === "movimientos" && <Movimientos productos={productos} movimientos={movimientos} />}
          {tab === "reposicion" && <Reposicion productos={productos} stockMap={stockMap} />}
        </>
      )}
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Ice Scroll</p>
          <h1>Control de insumos</h1>
        </div>
      </header>
      <main className="layout">{children}</main>
    </div>
  );
}

function SetupScreen() {
  return (
    <Shell>
      <section className="loginPanel">
        <AlertTriangle size={34} />
        <h2>Falta configurar Firebase</h2>
        <p>Crea un archivo .env desde .env.example y completa la configuración web del proyecto Firebase.</p>
      </section>
    </Shell>
  );
}

function SeedScreen() {
  return (
    <section className="emptyBlock">
      <Boxes size={42} />
      <h2>No hay productos cargados</h2>
      <p>Inicializa la base con los insumos base y luego podrás editarlos desde la nube.</p>
      <button className="primaryAction" onClick={() => seedDefaultProducts(DEFAULT_PRODUCTS)}>
        <Download size={18} />
        Cargar productos iniciales
      </button>
    </section>
  );
}

function EmptyState({ title }) {
  return <section className="emptyBlock"><h2>{title}</h2></section>;
}

function Panel({ productos, movimientos, stockMap }) {
  const resumen = productos.reduce(
    (acc, producto) => {
      const stock = stockMap[producto.id] || 0;
      const estado = estadoProducto(stock, producto.stockMinimo, producto.stockObjetivo);
      acc[estado] += 1;
      const faltante = Math.max(0, Number(producto.stockObjetivo || 0) - stock);
      acc.costo += faltante * Number(producto.precioNeto || 0);
      return acc;
    },
    { "Sin stock": 0, Reponer: 0, OK: 0, "Definir mínimo": 0, costo: 0 },
  );

  const cards = [
    { label: "Sin stock", value: resumen["Sin stock"], tone: "bad", icon: AlertTriangle },
    { label: "Reponer", value: resumen.Reponer, tone: "warn", icon: ShoppingCart },
    { label: "OK", value: resumen.OK, tone: "ok", icon: CheckCircle2 },
    { label: "Por definir", value: resumen["Definir mínimo"], tone: "muted", icon: Pencil },
  ];

  return (
    <section className="dashboard">
      <div className="metricGrid">
        {cards.map(({ label, value, tone, icon: Icon }) => (
          <article className={`metric ${tone}`} key={label}>
            <Icon size={20} />
            <strong>{value}</strong>
            <span>{label}</span>
          </article>
        ))}
      </div>
      <article className="widePanel">
        <span>Costo estimado de reposición</span>
        <strong>{money(resumen.costo)}</strong>
      </article>
      <article className="panel">
        <h2>Últimos movimientos</h2>
        {movimientos.slice(0, 8).length === 0 ? (
          <p className="mutedText">Aún no hay movimientos registrados.</p>
        ) : (
          <div className="movementList">
            {movimientos.slice(0, 8).map((mov) => <MovimientoItem key={mov.id} mov={mov} />)}
          </div>
        )}
      </article>
    </section>
  );
}

function Productos({ productos, stockMap }) {
  const [buscar, setBuscar] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [editing, setEditing] = useState(null);

  const filtrados = productos.filter((producto) => {
    const query = buscar.trim().toLowerCase();
    const matchQuery = !query || producto.nombre.toLowerCase().includes(query) || producto.id.toLowerCase().includes(query);
    const matchCat = categoria === "Todas" || producto.cat === categoria;
    return matchQuery && matchCat;
  });

  return (
    <section>
      <Toolbar buscar={buscar} setBuscar={setBuscar} categoria={categoria} setCategoria={setCategoria} />
      <div className="tableHeader">{filtrados.length} productos</div>
      <div className="productGrid">
        {filtrados.map((producto) => (
          <ProductCard key={producto.id} producto={producto} stock={stockMap[producto.id] || 0} onEdit={() => setEditing(producto)} />
        ))}
      </div>
      {editing && <ProductEditor producto={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function Toolbar({ buscar, setBuscar, categoria, setCategoria }) {
  return (
    <div className="toolbar">
      <label className="searchBox">
        <Search size={18} />
        <input value={buscar} onChange={(event) => setBuscar(event.target.value)} placeholder="Buscar producto o código" />
      </label>
      <select value={categoria} onChange={(event) => setCategoria(event.target.value)}>
        <option value="Todas">Todas las categorías</option>
        {CATEGORIAS.map((cat) => <option key={cat}>{cat}</option>)}
      </select>
    </div>
  );
}

function ProductCard({ producto, stock, onEdit }) {
  const estado = estadoProducto(stock, producto.stockMinimo, producto.stockObjetivo);
  return (
    <article className="productCard">
      <div className="productTop">
        <div>
          <h3>{producto.nombre}</h3>
          <p>{producto.id} · {producto.cat}</p>
        </div>
        <button className="iconButton" onClick={onEdit} aria-label={`Editar ${producto.nombre}`} title="Editar">
          <Pencil size={17} />
        </button>
      </div>
      <div className="stockLine">
        <strong>{stock}</strong>
        <Badge estado={estado} />
      </div>
      <div className="details">
        <span>Mín {producto.stockMinimo || 0}</span>
        <span>Obj {producto.stockObjetivo || 0}</span>
        <span>{money(producto.precioNeto)}</span>
        <span>{producto.proveedor}</span>
      </div>
    </article>
  );
}

function ProductEditor({ producto, onClose }) {
  const [form, setForm] = useState(producto);
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function save(event) {
    event.preventDefault();
    await updateProducto(producto.id, {
      ...form,
      stockInicial: Number(form.stockInicial) || 0,
      stockMinimo: Number(form.stockMinimo) || 0,
      stockObjetivo: Number(form.stockObjetivo) || 0,
      precioNeto: Number(form.precioNeto) || 0,
      updatedAt: Date.now(),
    });
    onClose();
  }

  async function remove() {
    if (confirm(`¿Eliminar ${producto.nombre}?`)) {
      await deleteProducto(producto.id);
      onClose();
    }
  }

  return (
    <div className="modalBackdrop" role="dialog" aria-modal="true">
      <form className="modal" onSubmit={save}>
        <h2>Editar producto</h2>
        <div className="formGrid">
          <label>Nombre<input value={form.nombre} onChange={(e) => setField("nombre", e.target.value)} required /></label>
          <label>Categoría<select value={form.cat} onChange={(e) => setField("cat", e.target.value)}>{CATEGORIAS.map((cat) => <option key={cat}>{cat}</option>)}</select></label>
          <label>Proveedor<select value={form.proveedor} onChange={(e) => setField("proveedor", e.target.value)}>{PROVEEDORES.map((prov) => <option key={prov}>{prov}</option>)}</select></label>
          <label>Unidad<input value={form.unidad || ""} onChange={(e) => setField("unidad", e.target.value)} /></label>
          <label>Stock inicial<input type="number" value={form.stockInicial || 0} onChange={(e) => setField("stockInicial", e.target.value)} /></label>
          <label>Stock mínimo<input type="number" value={form.stockMinimo || 0} onChange={(e) => setField("stockMinimo", e.target.value)} /></label>
          <label>Stock objetivo<input type="number" value={form.stockObjetivo || 0} onChange={(e) => setField("stockObjetivo", e.target.value)} /></label>
          <label>Precio neto<input type="number" value={form.precioNeto || 0} onChange={(e) => setField("precioNeto", e.target.value)} /></label>
          <label className="full">Observaciones<input value={form.observaciones || ""} onChange={(e) => setField("observaciones", e.target.value)} /></label>
        </div>
        <div className="modalActions">
          <button type="button" className="ghost dangerText" onClick={remove}><Trash2 size={16} />Eliminar</button>
          <span />
          <button type="button" className="ghost" onClick={onClose}>Cancelar</button>
          <button className="primaryAction" type="submit">Guardar</button>
        </div>
      </form>
    </div>
  );
}

function Movimientos({ productos, movimientos }) {
  const [form, setForm] = useState({
    productoId: "",
    tipo: "Entrada",
    cantidad: "",
    costoUnitario: "",
    responsable: "Eduardo",
    fecha: today(),
    motivo: "",
  });

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    const producto = productos.find((item) => item.id === form.productoId);
    if (!producto) return;
    const cantidad = Number(form.cantidad) || 0;
    const costoUnitario = Number(form.costoUnitario) || 0;
    await addMovimiento({
      ...form,
      cantidad,
      costoUnitario,
      costoTotal: cantidad * costoUnitario,
      productoNombre: producto.nombre,
      createdAt: Date.now(),
    });
    setForm({ productoId: "", tipo: "Entrada", cantidad: "", costoUnitario: "", responsable: "Eduardo", fecha: today(), motivo: "" });
  }

  return (
    <section className="split">
      <form className="panel movementForm" onSubmit={submit}>
        <h2>Registrar movimiento</h2>
        <label>Producto<select value={form.productoId} onChange={(e) => setField("productoId", e.target.value)} required><option value="">Seleccionar</option>{productos.map((p) => <option value={p.id} key={p.id}>{p.nombre}</option>)}</select></label>
        <div className="formGrid two">
          <label>Tipo<select value={form.tipo} onChange={(e) => setField("tipo", e.target.value)}>{TIPOS_MOV.map((tipo) => <option key={tipo}>{tipo}</option>)}</select></label>
          <label>Cantidad<input type="number" min="0" step="0.01" value={form.cantidad} onChange={(e) => setField("cantidad", e.target.value)} required /></label>
          <label>Costo unitario<input type="number" min="0" value={form.costoUnitario} onChange={(e) => setField("costoUnitario", e.target.value)} /></label>
          <label>Responsable<select value={form.responsable} onChange={(e) => setField("responsable", e.target.value)}>{RESPONSABLES.map((r) => <option key={r}>{r}</option>)}</select></label>
          <label>Fecha<input type="date" value={form.fecha} onChange={(e) => setField("fecha", e.target.value)} /></label>
          <label>Motivo<input value={form.motivo} onChange={(e) => setField("motivo", e.target.value)} placeholder="Factura, merma, ajuste..." /></label>
        </div>
        <button className="primaryAction" type="submit"><Plus size={18} />Registrar</button>
      </form>
      <div className="panel">
        <h2>Historial</h2>
        <div className="movementList">
          {movimientos.map((mov) => <MovimientoItem key={mov.id} mov={mov} />)}
        </div>
      </div>
    </section>
  );
}

function MovimientoItem({ mov }) {
  const positive = ["Entrada", "Ajuste +"].includes(mov.tipo);
  return (
    <article className="movementItem">
      <div>
        <strong>{mov.productoNombre}</strong>
        <span>{mov.fecha} · {mov.tipo} · {mov.responsable}</span>
        {mov.motivo && <span>{mov.motivo}</span>}
      </div>
      <div className={positive ? "qty positive" : "qty negative"}>
        {positive ? "+" : "-"}{mov.cantidad}
        {mov.costoTotal > 0 && <small>{money(mov.costoTotal)}</small>}
      </div>
    </article>
  );
}

function Reposicion({ productos, stockMap }) {
  const [proveedor, setProveedor] = useState("Todos");
  const proveedores = [...new Set(productos.map((p) => p.proveedor))].sort();
  const lista = productos
    .map((producto) => {
      const stock = stockMap[producto.id] || 0;
      const falta = Math.max(0, Number(producto.stockObjetivo || 0) - stock);
      return { ...producto, stock, falta, estado: estadoProducto(stock, producto.stockMinimo, producto.stockObjetivo) };
    })
    .filter((producto) => ["Sin stock", "Reponer"].includes(producto.estado) && (proveedor === "Todos" || producto.proveedor === proveedor));

  const total = lista.reduce((sum, item) => sum + item.falta * Number(item.precioNeto || 0), 0);

  return (
    <section>
      <div className="toolbar">
        <select value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
          <option value="Todos">Todos los proveedores</option>
          {proveedores.map((prov) => <option key={prov}>{prov}</option>)}
        </select>
        <div className="totalBox">{lista.length} productos · {money(total)}</div>
      </div>
      <div className="productGrid">
        {lista.map((producto) => (
          <article className="productCard" key={producto.id}>
            <div className="productTop">
              <div>
                <h3>{producto.nombre}</h3>
                <p>{producto.proveedor} · {producto.id}</p>
              </div>
              <Badge estado={producto.estado} />
            </div>
            <div className="details">
              <span>Stock {producto.stock}</span>
              <span>Objetivo {producto.stockObjetivo}</span>
              <span>Pedir {producto.falta}</span>
              <span>{money(producto.falta * Number(producto.precioNeto || 0))}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function Badge({ estado }) {
  const className = {
    "Sin stock": "badge bad",
    Reponer: "badge warn",
    OK: "badge ok",
    "Definir mínimo": "badge muted",
  }[estado] || "badge muted";
  return <span className={className}>{estado}</span>;
}

createRoot(document.getElementById("root")).render(<App />);

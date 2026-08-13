// Cobrar.tsx
import React, { useState } from 'react';
import { crearPago, type PagoPayload } from '../../api/pagos';
import './Cobrar.css';

interface CobrarProps {
  consultaId?: number | null;
  onCobrado?: () => void;
}

// Mapeo temporal método -> id en la tabla metodos_pago.
// Ajusta los IDs si no coinciden con tu catálogo real.
const METODO_PAGO_IDS: Record<string, number> = {
  Efectivo: 1,
  QR: 2,
};

const Cobrar: React.FC<CobrarProps> = ({ consultaId, onCobrado }) => {
  // Estados del formulario
  const [montoBase, setMontoBase] = useState<string>('150.00');
  const [descuento, setDescuento] = useState<string>('0.00');
  const [metodoPago, setMetodoPago] = useState<string>('Efectivo');
  const [montoRecibido, setMontoRecibido] = useState<string>('');
  const [referencia, setReferencia] = useState<string>('');

  // Estados de la petición al backend
  const [enviando, setEnviando] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Cálculos derivados
  const baseNum = parseFloat(montoBase) || 0;
  const descNum = parseFloat(descuento) || 0;
  const totalPagar = Math.max(baseNum - descNum, 0);

  // Cálculo del cambio / faltante
  const recibidoNum = parseFloat(montoRecibido);
  const cambio = !isNaN(recibidoNum) ? recibidoNum - totalPagar : 0;

  // Manejadores
  const handleConfirmar = async () => {
    setError(null);

    if (totalPagar <= 0) {
      alert('El total a pagar debe ser mayor a 0.');
      return;
    }

    if (metodoPago === 'Efectivo') {
      if (isNaN(recibidoNum) || recibidoNum < totalPagar) {
        alert('El monto recibido debe ser igual o mayor al total.');
        return;
      }
    }

    const payload: PagoPayload = {
      consulta_id: consultaId ?? null,
      monto: baseNum,
      descuento: descNum,
      metodo_pago_id: METODO_PAGO_IDS[metodoPago],
      monto_pago: totalPagar,
      referencia: referencia || null,
    };

    try {
      setEnviando(true);
      const pago = await crearPago(payload);
      alert(
        ` Pago confirmado:\nMonto: Bs ${totalPagar.toFixed(2)}\nMétodo: ${metodoPago}\nRecibo: ${pago.numero_recibo_pago}`
      );
      handleLimpiar();
      onCobrado?.();
    } catch (err: any) {
      const mensaje =
        err?.response?.data?.error || 'Ocurrió un error al registrar el pago.';
      setError(mensaje);
    } finally {
      setEnviando(false);
    }
  };

  const handleLimpiar = () => {
    setMontoBase('150.00');
    setDescuento('0.00');
    setMontoRecibido('');
    setMetodoPago('Efectivo');
    setReferencia('');
  };

  return (
    <div className="cobrar-wrapper">
      <div className="pago-container">
        {/* HEADER */}
        <div className="cb-header">
          <div>
            <h1><i className="fas fa-coins"></i> Registrar pago</h1>
            <p className="cb-subtitle">Complete los datos para finalizar el cobro</p>
          </div>
        </div>

        {/* FORMULARIO */}
        <div className="cb-section">
          <div className="cb-section-title">
            <i className="fas fa-hand-holding-usd"></i> Datos del pago
          </div>

          {error && (
            <div className="cb-cambio-info cb-text-danger" style={{ marginBottom: '1rem' }}>
              <i className="fas fa-exclamation-circle"></i> {error}
            </div>
          )}

          <form onSubmit={(e) => e.preventDefault()}>
            {/* Monto Base */}
            <div className="cb-form-group">
              <label htmlFor="montoBaseInput">Monto a cobrar (Bs)</label>
              <input
                type="number"
                id="montoBaseInput"
                className="cb-form-control"
                step="0.01"
                min="0.01"
                value={montoBase}
                onChange={(e) => setMontoBase(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Descuento */}
            <div className="cb-form-group">
              <label htmlFor="descuentoInput">Descuento (Bs)</label>
              <input
                type="number"
                id="descuentoInput"
                className="cb-form-control"
                step="0.01"
                min="0"
                value={descuento}
                onChange={(e) => setDescuento(e.target.value)}
                placeholder="0.00"
              />
            </div>

            {/* Total (Readonly) */}
            <div className="cb-form-group">
              <label htmlFor="totalPagarInput">Total a pagar (Bs)</label>
              <input
                type="number"
                id="totalPagarInput"
                className="cb-form-control cb-total-field"
                value={totalPagar.toFixed(2)}
                readOnly
              />
            </div>

            {/* Método de pago */}
            <div className="cb-form-group">
              <label htmlFor="metodoPago">Método de pago</label>
              <select
                id="metodoPago"
                className="cb-form-control"
                value={metodoPago}
                onChange={(e) => {
                  setMetodoPago(e.target.value);
                  setMontoRecibido('');
                  setReferencia('');
                }}
              >
                <option value="Efectivo">Efectivo</option>
                <option value="QR">QR</option>
              </select>
            </div>

            {/* Campo condicional para Efectivo */}
            {metodoPago === 'Efectivo' && (
              <div className="cb-form-group">
                <label htmlFor="montoRecibido">Monto recibido (Bs)</label>
                <input
                  type="number"
                  id="montoRecibido"
                  className="cb-form-control"
                  step="0.01"
                  min="0"
                  value={montoRecibido}
                  onChange={(e) => setMontoRecibido(e.target.value)}
                  placeholder="0.00"
                />
                {montoRecibido && !isNaN(recibidoNum) && (
                  <div className={cambio >= 0 ? 'cb-cambio-info' : 'cb-cambio-info cb-text-danger'}>
                    {cambio >= 0
                      ? `Cambio: Bs ${cambio.toFixed(2)}`
                      : `Faltan Bs ${Math.abs(cambio).toFixed(2)}`}
                  </div>
                )}
              </div>
            )}

            {/* Campo condicional para QR */}
            {metodoPago === 'QR' && (
              <div className="cb-form-group">
                <label htmlFor="referenciaInput">Referencia / N° de transacción</label>
                <input
                  type="text"
                  id="referenciaInput"
                  className="cb-form-control"
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Opcional"
                />
              </div>
            )}

            {/* Botones */}
            <div className="cb-form-actions">
              <button
                type="button"
                className="cb-btn-primary"
                onClick={handleConfirmar}
                disabled={enviando}
              >
                <i className={enviando ? 'fas fa-spinner fa-spin' : 'fas fa-check-circle'}></i>{' '}
                {enviando ? 'Procesando...' : 'Confirmar pago'}
              </button>
              <button
                type="button"
                className="cb-btn-secondary"
                onClick={handleLimpiar}
                disabled={enviando}
              >
                <i className="fas fa-undo-alt"></i> Limpiar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Cobrar;
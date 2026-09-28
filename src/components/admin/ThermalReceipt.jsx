import React from 'react';
import { Printer, X, Check, Copy } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export function ThermalReceipt({ order, onClose }) {
  if (!order) return null;

  // Group items by operation (AÇAÍ, BURGUER, PIZZA)
  const groupedItems = {};
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach(item => {
      const bName = (item.business_name || "KING'S GERAL").toUpperCase();
      if (!groupedItems[bName]) {
        groupedItems[bName] = [];
      }
      groupedItems[bName].push(item);
    });
  }

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-amber-400" />
            <span className="font-semibold text-slate-100">Impressão Térmica (80mm)</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo Visível e para Impressão */}
        <div className="p-6 overflow-y-auto bg-slate-950/40 flex justify-center">
          <div
            id="thermal-receipt-print-area"
            className="w-[78mm] bg-white text-black p-4 font-mono text-[11px] leading-tight shadow-md rounded-sm select-all"
          >
            {/* Header da Marca */}
            <div className="text-center pb-2 border-b border-black">
              <div className="text-lg font-bold tracking-wider">KING'S</div>
              <div className="text-xs uppercase font-semibold">GESTÃO & DELIVERY</div>
              <div className="text-[10px] mt-0.5">PEDIDO #{order.order_number}</div>
              <div className="text-[9px] mt-0.5">{formatDateTime(order.created_at)}</div>
              <div className="text-[9px] font-bold mt-1 uppercase">
                {order.delivery_type === 'delivery' ? '--- ENTREGA EM DOMICÍLIO ---' : '--- RETIRADA NO BALCÃO ---'}
              </div>
            </div>

            {/* Itens agrupados por Operação */}
            <div className="py-2 space-y-3">
              {Object.keys(groupedItems).map(groupName => (
                <div key={groupName} className="space-y-1">
                  <div className="font-bold border-b border-dashed border-gray-400 pb-0.5 text-[10px] uppercase">
                    {groupName}
                  </div>
                  {groupedItems[groupName].map((item, idx) => (
                    <div key={idx} className="pt-0.5">
                      <div className="flex justify-between font-bold">
                        <span>{item.quantity}x {item.product_name}</span>
                        <span>{formatCurrency(item.subtotal)}</span>
                      </div>
                      {/* Adicionais */}
                      {item.addons && item.addons.map((add, aIdx) => (
                        <div key={aIdx} className="text-[10px] text-gray-700 pl-3">
                          + {add.name} {add.unit_price > 0 && `(${formatCurrency(add.unit_price)})`}
                        </div>
                      ))}
                      {/* Observação do item */}
                      {item.notes && (
                        <div className="text-[9px] italic text-gray-600 pl-3">
                          Obs: {item.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Totais */}
            <div className="pt-2 border-t border-black space-y-0.5">
              <div className="flex justify-between">
                <span>SUBTOTAL:</span>
                <span>{formatCurrency(order.subtotal)}</span>
              </div>
              {order.delivery_type === 'delivery' && (
                <div className="flex justify-between">
                  <span>TAXA ENTREGA:</span>
                  <span>{formatCurrency(order.delivery_fee)}</span>
                </div>
              )}
              {order.discount > 0 && (
                <div className="flex justify-between text-gray-700">
                  <span>DESCONTO:</span>
                  <span>- {formatCurrency(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-xs pt-1 border-t border-dashed border-gray-400">
                <span>TOTAL:</span>
                <span>{formatCurrency(order.total)}</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>PAGAMENTO:</span>
                <span className="font-bold uppercase">{order.payment_method}</span>
              </div>
              {order.payment_method === 'DINHEIRO' && order.payment_change > 0 && (
                <div className="flex justify-between text-[10px]">
                  <span>Troco para:</span>
                  <span>{formatCurrency(order.payment_change)} (Troco: {formatCurrency(order.payment_change - order.total)})</span>
                </div>
              )}
              <div className="flex justify-between text-[10px]">
                <span>STATUS PAGTO:</span>
                <span className="uppercase">{order.payment_status}</span>
              </div>
            </div>

            {/* Dados do Cliente */}
            <div className="pt-2 mt-2 border-t border-black">
              <div className="font-bold uppercase text-[10px] mb-0.5">
                {order.delivery_type === 'delivery' ? 'DADOS PARA ENTREGA' : 'DADOS DO CLIENTE'}
              </div>
              <div className="font-bold">{order.customer_name}</div>
              <div>Tel: {order.customer_phone}</div>
              {order.delivery_type === 'delivery' && (
                <>
                  <div className="mt-0.5">{order.delivery_address}</div>
                  {order.delivery_neighborhood && <div>Bairro: {order.delivery_neighborhood}</div>}
                </>
              )}
              {order.notes && (
                <div className="mt-1 pt-1 border-t border-dashed border-gray-300 text-[10px]">
                  <span className="font-bold">Observações gerais:</span> {order.notes}
                </div>
              )}
            </div>

            {/* Rodapé */}
            <div className="mt-3 pt-2 border-t border-black text-center text-[9px]">
              <div>*** OBRIGADO PELA PREFERÊNCIA! ***</div>
              <div>KING'S - QUALIDADE & SABOR</div>
            </div>
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">Formato padrão 80mm / bobina térmica</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Imprimir Pedido</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

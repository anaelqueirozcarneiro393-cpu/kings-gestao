import React, { useState, useEffect } from 'react';
import { Printer, X, Check, Copy, ChefHat, Bike, Receipt, Settings2, Sparkles, Scissors } from 'lucide-react';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export function ThermalReceipt({ order, initialView = 'completa', onClose }) {
  if (!order) return null;

  // View mode: 'completa' | 'cozinha' | 'entrega' | 'duas_vias'
  const [ticketView, setTicketView] = useState(() => {
    return localStorage.getItem('kings_printer_default_view') || initialView;
  });

  // Printer paper width: '80mm' | '58mm'
  const [paperWidth, setPaperWidth] = useState(() => {
    return localStorage.getItem('kings_printer_width') || '80mm';
  });

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    localStorage.setItem('kings_printer_default_view', ticketView);
  }, [ticketView]);

  useEffect(() => {
    localStorage.setItem('kings_printer_width', paperWidth);
  }, [paperWidth]);

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

  // Generate plain text version for copying / bluetooth print apps
  const generatePlainText = () => {
    const isDelivery = order.delivery_type === 'delivery';
    let text = `================================\n`;
    text += `       KING'S GESTAO & DELIVERY\n`;
    text += `================================\n`;
    text += `PEDIDO #${order.order_number}\n`;
    text += `DATA: ${formatDateTime(order.created_at)}\n`;
    text += `TIPO: ${isDelivery ? '>>> ENTREGA EM DOMICILIO <<<' : '>>> RETIRADA NO BALCAO <<<'}\n`;
    text += `--------------------------------\n`;
    text += `CLIENTE: ${order.customer_name}\n`;
    text += `TEL/WPP: ${order.customer_phone}\n`;
    if (isDelivery) {
      text += `END: ${order.delivery_address}\n`;
      if (order.delivery_neighborhood) text += `BAIRRO: ${order.delivery_neighborhood}\n`;
    }
    if (order.notes) text += `OBS GERAL: ${order.notes}\n`;
    text += `--------------------------------\n`;
    text += `ITENS DO PEDIDO:\n`;

    Object.keys(groupedItems).forEach(groupName => {
      text += `\n[ ${groupName} ]\n`;
      groupedItems[groupName].forEach(item => {
        text += `${item.quantity}x ${item.product_name} - ${formatCurrency(item.subtotal)}\n`;
        if (item.addons && item.addons.length > 0) {
          item.addons.forEach(add => {
            text += `  + ${add.name} ${add.unit_price > 0 ? `(${formatCurrency(add.unit_price)})` : '(Grátis)'}\n`;
          });
        }
        if (item.notes) text += `  Obs: ${item.notes}\n`;
      });
    });

    text += `--------------------------------\n`;
    text += `SUBTOTAL: ${formatCurrency(order.subtotal)}\n`;
    if (isDelivery) text += `TAXA ENTREGA: ${formatCurrency(order.delivery_fee)}\n`;
    if (order.discount > 0) text += `DESCONTO: -${formatCurrency(order.discount)}\n`;
    text += `TOTAL: ${formatCurrency(order.total)}\n`;
    text += `PAGAMENTO: ${order.payment_method}\n`;
    if (order.payment_method === 'DINHEIRO' && order.payment_change > 0) {
      text += `TROCO PARA: ${formatCurrency(order.payment_change)} (Troco: ${formatCurrency(order.payment_change - order.total)})\n`;
    }
    text += `================================\n`;
    return text;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(generatePlainText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Falha ao copiar:', err);
    }
  };

  // Render Cozinha / Produção
  const renderKitchenSection = () => (
    <div className="kitchen-ticket py-1">
      {/* Header Produção */}
      <div className="text-center pb-2 border-b-2 border-black">
        <div className="text-[14px] font-black tracking-wider uppercase">
          *** COMANDA DE COZINHA ***
        </div>
        <div className="text-[20px] font-black my-1 border-2 border-black py-0.5 bg-black text-white">
          PEDIDO #{order.order_number}
        </div>
        <div className="flex justify-between text-[10px] font-bold mt-1 uppercase">
          <span>HORA: {formatDateTime(order.created_at).split(' ')[1] || formatDateTime(order.created_at)}</span>
          <span>{order.delivery_type === 'delivery' ? '🛵 ENTREGA' : '🏪 BALCÃO'}</span>
        </div>
        <div className="text-[11px] font-bold text-left mt-1 border-t border-dashed border-black pt-1">
          CLIENTE: {order.customer_name}
        </div>
      </div>

      {/* Itens para Preparo */}
      <div className="py-2 space-y-3">
        {Object.keys(groupedItems).map(groupName => (
          <div key={groupName} className="space-y-1.5">
            <div className="text-[11px] font-black uppercase bg-black text-white px-1 py-0.5">
              {groupName}
            </div>

            {groupedItems[groupName].map((item, idx) => (
              <div key={idx} className="pb-1.5 border-b border-dashed border-gray-400">
                <div className="text-[13px] font-black flex items-start gap-1">
                  <span className="text-[15px] bg-gray-200 px-1 font-mono">[{item.quantity}x]</span>
                  <span className="uppercase">{item.product_name}</span>
                </div>

                {/* Adicionais & Complementos & Ponto da Carne */}
                {item.addons && item.addons.length > 0 && (
                  <div className="mt-1 pl-2 space-y-0.5">
                    {item.addons.map((add, aIdx) => {
                      const isMeatDoneness = add.name.toLowerCase().includes('ponto') || add.name.toLowerCase().includes('passado');
                      return (
                        <div
                          key={aIdx}
                          className={`text-[11px] leading-tight ${
                            isMeatDoneness ? 'font-black bg-gray-100 p-0.5 border border-black' : 'font-bold'
                          }`}
                        >
                          → {add.name}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Observação Específica do Item */}
                {item.notes && (
                  <div className="mt-1 p-1 bg-yellow-100 border border-black text-[11px] font-black uppercase">
                    ATENÇÃO OBS: {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Observações Gerais */}
      {order.notes && (
        <div className="p-1.5 border-2 border-black bg-yellow-100 mt-2 text-[11px] font-black uppercase">
          OBS GERAL: {order.notes}
        </div>
      )}

      <div className="text-center text-[9px] font-bold mt-2 pt-1 border-t border-black uppercase">
        FIM DA COMANDA DE COZINHA • #{order.order_number}
      </div>
    </div>
  );

  // Render Entrega / Motoboy
  const renderDeliverySection = () => (
    <div className="delivery-ticket py-1">
      <div className="text-center pb-2 border-b-2 border-black">
        <div className="text-[13px] font-black tracking-wider uppercase">
          *** VIA DO MOTOBOY / ENTREGA ***
        </div>
        <div className="text-[18px] font-black my-0.5">
          PEDIDO #{order.order_number}
        </div>
        <div className="text-[10px]">
          {formatDateTime(order.created_at)}
        </div>
      </div>

      {/* Dados do Destinatário */}
      <div className="py-2 space-y-1.5 border-b-2 border-black">
        <div className="text-[13px] font-black uppercase">
          {order.customer_name}
        </div>
        <div className="text-[12px] font-bold">
          WHATSAPP: {order.customer_phone}
        </div>

        {order.delivery_type === 'delivery' ? (
          <div className="p-1.5 bg-gray-100 border border-black rounded-sm space-y-0.5">
            <div className="text-[10px] font-bold uppercase text-gray-700">Endereço de Entrega:</div>
            <div className="text-[12px] font-black leading-tight">{order.delivery_address}</div>
            {order.delivery_neighborhood && (
              <div className="text-[11px] font-bold uppercase mt-0.5">
                BAIRRO: {order.delivery_neighborhood}
              </div>
            )}
          </div>
        ) : (
          <div className="p-1.5 bg-black text-white font-black text-center text-xs uppercase">
            RETIRADA NO BALCÃO DA LOJA
          </div>
        )}

        {order.notes && (
          <div className="text-[10px] font-bold p-1 bg-yellow-100 border border-black uppercase">
            PONTO DE REF / OBS: {order.notes}
          </div>
        )}
      </div>

      {/* Resumo Financeiro para Cobrança */}
      <div className="py-2 space-y-1 border-b-2 border-black">
        <div className="flex justify-between text-[11px]">
          <span>FORMA DE PAGTO:</span>
          <span className="font-black uppercase">{order.payment_method}</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span>STATUS PAGTO:</span>
          <span className="font-black uppercase">{order.payment_status}</span>
        </div>
        {order.delivery_type === 'delivery' && (
          <div className="flex justify-between text-[10px]">
            <span>TAXA DE ENTREGA:</span>
            <span>{formatCurrency(order.delivery_fee)}</span>
          </div>
        )}
        <div className="flex justify-between text-[14px] font-black pt-1 border-t border-dashed border-black">
          <span>VALOR A COBRAR:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>

        {order.payment_method === 'DINHEIRO' && order.payment_change > 0 && (
          <div className="p-1 bg-yellow-100 border border-black text-[11px] font-black mt-1">
            LEVAR TROCO DE {formatCurrency(order.payment_change - order.total)} (PAGOU COM {formatCurrency(order.payment_change)})
          </div>
        )}
      </div>

      {/* Volumes */}
      <div className="pt-2 text-center text-[10px] font-bold">
        VOLUMES: {order.items?.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0)} ITEM(NS)
      </div>
    </div>
  );

  // Render Via Completa (Padrão)
  const renderCompleteSection = () => (
    <div className="complete-ticket">
      {/* Header da Marca */}
      <div className="text-center pb-2 border-b-2 border-black">
        <div className="text-xl font-black tracking-widest">KING'S</div>
        <div className="text-xs uppercase font-extrabold">GESTÃO & DELIVERY</div>
        <div className="text-sm font-black mt-1 py-0.5 border border-black">
          PEDIDO #{order.order_number}
        </div>
        <div className="text-[9px] mt-1 font-bold">{formatDateTime(order.created_at)}</div>
        <div className="text-[10px] font-black mt-1 uppercase bg-black text-white py-0.5">
          {order.delivery_type === 'delivery' ? '--- ENTREGA EM DOMICÍLIO ---' : '--- RETIRADA NO BALCÃO ---'}
        </div>
      </div>

      {/* Itens agrupados por Operação */}
      <div className="py-2 space-y-3">
        {Object.keys(groupedItems).map(groupName => (
          <div key={groupName} className="space-y-1">
            <div className="font-black border-b border-black pb-0.5 text-[10px] uppercase bg-gray-100 px-1">
              {groupName}
            </div>
            {groupedItems[groupName].map((item, idx) => (
              <div key={idx} className="pt-1 pb-1 border-b border-dashed border-gray-300">
                <div className="flex justify-between font-bold text-[12px]">
                  <span>{item.quantity}x {item.product_name}</span>
                  <span>{formatCurrency(item.subtotal)}</span>
                </div>
                {/* Adicionais */}
                {item.addons && item.addons.map((add, aIdx) => (
                  <div key={aIdx} className="text-[10px] text-gray-800 pl-2 font-medium">
                    + {add.name} {add.unit_price > 0 ? `(${formatCurrency(add.unit_price)})` : '(Grátis)'}
                  </div>
                ))}
                {/* Observação do item */}
                {item.notes && (
                  <div className="text-[10px] font-bold italic bg-gray-50 pl-2 mt-0.5">
                    Obs: {item.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Totais */}
      <div className="pt-2 border-t-2 border-black space-y-0.5 text-[11px]">
        <div className="flex justify-between font-bold">
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
          <div className="flex justify-between text-gray-800">
            <span>DESCONTO:</span>
            <span>- {formatCurrency(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between font-black text-[13px] pt-1 border-t-2 border-black">
          <span>TOTAL:</span>
          <span>{formatCurrency(order.total)}</span>
        </div>
        <div className="flex justify-between pt-1">
          <span>FORMA PAGTO:</span>
          <span className="font-black uppercase">{order.payment_method}</span>
        </div>
        {order.payment_method === 'DINHEIRO' && order.payment_change > 0 && (
          <div className="flex justify-between text-[10px] font-bold">
            <span>Troco para:</span>
            <span>{formatCurrency(order.payment_change)} (Troco: {formatCurrency(order.payment_change - order.total)})</span>
          </div>
        )}
        <div className="flex justify-between text-[10px]">
          <span>STATUS PAGTO:</span>
          <span className="uppercase font-bold">{order.payment_status}</span>
        </div>
      </div>

      {/* Dados do Cliente */}
      <div className="pt-2 mt-2 border-t-2 border-black text-[11px]">
        <div className="font-black uppercase text-[10px] mb-0.5">
          {order.delivery_type === 'delivery' ? 'DADOS PARA ENTREGA' : 'DADOS DO CLIENTE'}
        </div>
        <div className="font-black text-[12px]">{order.customer_name}</div>
        <div className="font-bold">Tel: {order.customer_phone}</div>
        {order.delivery_type === 'delivery' && (
          <>
            <div className="mt-0.5 font-medium leading-tight">{order.delivery_address}</div>
            {order.delivery_neighborhood && <div className="font-bold">Bairro: {order.delivery_neighborhood}</div>}
          </>
        )}
        {order.notes && (
          <div className="mt-1 pt-1 border-t border-dashed border-gray-400 text-[10px] font-bold">
            Observações: {order.notes}
          </div>
        )}
      </div>

      {/* Rodapé */}
      <div className="mt-3 pt-2 border-t border-black text-center text-[9px] font-bold uppercase space-y-0.5">
        <div>*** OBRIGADO PELA PREFERÊNCIA! ***</div>
        <div>KING'S - QUALIDADE & SABOR</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh]">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Printer className="w-4 h-4" />
            </div>
            <div>
              <div className="font-bold text-slate-100 text-sm flex items-center gap-2">
                <span>Impressão Térmica</span>
                <span className="text-xs font-mono text-amber-400 font-normal">#{order.order_number}</span>
              </div>
              <p className="text-[11px] text-slate-400">Pronto para bobinas de 80mm e 58mm</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar de Controle de Vias e Bobina */}
        <div className="px-5 py-2.5 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Seletor de Tipo de Via */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <button
              onClick={() => setTicketView('completa')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                ticketView === 'completa' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Via completa para o cliente / balcão"
            >
              <Receipt className="w-3.5 h-3.5" />
              <span>Completa</span>
            </button>

            <button
              onClick={() => setTicketView('cozinha')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                ticketView === 'cozinha' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Via de produção / cozinha sem preços"
            >
              <ChefHat className="w-3.5 h-3.5" />
              <span>Cozinha</span>
            </button>

            <button
              onClick={() => setTicketView('entrega')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                ticketView === 'entrega' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Via do motoboy / entrega"
            >
              <Bike className="w-3.5 h-3.5" />
              <span>Entrega</span>
            </button>

            <button
              onClick={() => setTicketView('duas_vias')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                ticketView === 'duas_vias' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
              title="Cozinha + Entrega com linha de corte"
            >
              <Scissors className="w-3.5 h-3.5" />
              <span>2 Vias</span>
            </button>
          </div>

          {/* Seletor de Largura da Bobina */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-500 px-1 font-semibold uppercase">Bobina:</span>
            <button
              onClick={() => setPaperWidth('80mm')}
              className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                paperWidth === '80mm' ? 'bg-slate-700 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              80mm
            </button>
            <button
              onClick={() => setPaperWidth('58mm')}
              className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                paperWidth === '58mm' ? 'bg-slate-700 text-amber-300' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              58mm
            </button>
          </div>
        </div>

        {/* Pré-visualização do Cupom Térmico */}
        <div className="p-6 overflow-y-auto bg-slate-950/70 flex justify-center items-start">
          <div
            id="thermal-receipt-print-area"
            className={`bg-white text-black font-mono shadow-2xl rounded-sm select-all ${
              paperWidth === '58mm' ? 'width-58mm w-[54mm] p-2 text-[10px]' : 'width-80mm w-[78mm] p-4 text-[11px]'
            }`}
          >
            {ticketView === 'cozinha' && renderKitchenSection()}
            {ticketView === 'entrega' && renderDeliverySection()}
            {ticketView === 'completa' && renderCompleteSection()}
            {ticketView === 'duas_vias' && (
              <div className="space-y-4">
                {renderKitchenSection()}
                <div className="my-3 py-1 border-t-2 border-b-2 border-dashed border-black text-center text-[10px] font-black tracking-widest">
                  ✂ - - - - - CORTE AQUI - - - - - ✂
                </div>
                {renderDeliverySection()}
              </div>
            )}
          </div>
        </div>

        {/* Footer com Ações */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="Copiar texto para colar em apps Bluetooth ou WhatsApp"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Fechar
            </button>
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
            >
              <Printer className="w-4 h-4 stroke-[2.5]" />
              <span>Imprimir Agora (Ctrl+P)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

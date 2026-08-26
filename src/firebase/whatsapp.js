import { 
  executeDispatch, 
  confirmMessageDelivery, 
  sanitizePhoneNumber, 
  getTemplateBody,
  DispatchConfig
} from './dispatchEngine.js';

/**
 * Função retrocompatível que invoca o DispatchEngine central.
 */
export async function triggerWhatsAppDispatch(params) {
  return await executeDispatch(params);
}

export { 
  executeDispatch, 
  confirmMessageDelivery, 
  sanitizePhoneNumber, 
  getTemplateBody,
  DispatchConfig
};

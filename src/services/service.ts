export interface XMIFService {
  name: string;
  init: () => Promise<void>;
}

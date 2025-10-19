enum CONNECTION {
  TOR = 'TOR',
  NORMAL = 'NORMAL'
}

type ResponseType = 'json' | 'text' | 'arrayBuffer' | 'blob';

class TorController {
  private conn: Deno.Conn | null = null;
  private host: string;
  private controlPort: number;
  private socksPort: number;
  private password: string;
  private proxiedClient: Deno.HttpClient | null = null;
  private publicClient: Deno.HttpClient | null = null;

  constructor(host = "127.0.0.1", socksPort = 9050, controlPort = 9051, password?: string) {
    this.host = host;
    this.controlPort = controlPort;
    this.socksPort = socksPort;
    this.password = password ?? "";
    
    try {
      this.proxiedClient = Deno.createHttpClient({
        proxy: {
          url: Deno.env.get('HTTPS_PROXY') ??  `socks5://${host}:${socksPort}`
        } 
      });

       this.publicClient = Deno.createHttpClient({});
    }catch (error) {
      console.error("Error initializing TorController:", error);
      throw error;
    }
  }

  private get connectionConfig() {
    return {
      [CONNECTION.TOR]: this.proxiedClient,
      [CONNECTION.NORMAL]: this.publicClient
    } as const;
  }

  private async connect(): Promise<void> {
    if (this.conn) return;
    
    try {
      this.conn = await Deno.connect({
        hostname: this.host,
        port: this.controlPort,
      });
    } catch (error) {
      throw new Error(`Failed to connect to Tor control port: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
  }

  private async sendCommand(command: string): Promise<string> {
    if (!this.conn) {
      throw new Error("Not connected to Tor control port");
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    
    await this.conn.write(encoder.encode(command + "\r\n"));
    
    const buffer = new Uint8Array(1024);
    const bytesRead = await this.conn.read(buffer);
    
    if (!bytesRead) {
      throw new Error("No response from Tor control port");
    }
    
    return decoder.decode(buffer.slice(0, bytesRead));
  }

  private async waitForCircuitReady(): Promise<void> {
    const response = await this.sendCommand("SETEVENTS CIRC");
    console.log("Debug: SETEVENTS response:", response.trim());
    
    const decoder = new TextDecoder();
    
    while (true) {
      const buffer = new Uint8Array(1024);
      const bytesRead = await this.conn!.read(buffer);
      
      if (!bytesRead) continue;
      
      const event = decoder.decode(buffer.slice(0, bytesRead));
      console.log("Debug: Tor event received:", event.trim());
      
      if (event.includes("650 CIRC") && event.includes("BUILT")) {
        console.log("Debug: Found BUILT circuit event");
        break;
      }
    }
    
    await this.sendCommand("SETEVENTS");
  }

  private async authenticate(): Promise<void> {
    const response = await this.sendCommand(`AUTHENTICATE "${this.password}"`);
    
    if (!response.startsWith("250")) {
      throw new Error(`Authentication failed: ${response.trim()}`);
    }
  }

  async getCurrentIP(mode: CONNECTION = CONNECTION.TOR): Promise<string | null> {
    try {
      const client = this.connectionConfig[mode];
      if (!client) {
        throw new Error(`Client for ${mode} connection not available`);
      }
      
      const req = await fetch('http://httpbin.org/ip', { client });
      const data = await req.json();
      return data.origin;
    } catch (error) {
      console.error(`Error getting IP for ${mode}:`, error);
      return null;
    }
  }

  async fetchThroughTor<T = unknown>(
    url: string,
    responseType: ResponseType = 'json',
    options?: RequestInit
  ): Promise<T | null> {
    try {
      if (!this.proxiedClient) {
        throw new Error("Tor proxied client not available");
      }

      const response = await fetch(url, {
        client: this.proxiedClient,
        ...options
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      switch (responseType) {
        case 'json':
          return await response.json() as T;
        case 'text':
          return await response.text() as T;
        case 'arrayBuffer':
          return await response.arrayBuffer() as T;
        case 'blob':
          return await response.blob() as T;
        default:
          throw new Error(`Unsupported response type: ${responseType}`);
      }
    } catch (error) {
      console.error(`Error fetching ${url} through Tor:`, error);
      return null;
    }
  }

  getTorClient(): Deno.HttpClient | null {
    return this.proxiedClient;
  }

  getPublicClient(): Deno.HttpClient | null {
    return this.publicClient;
  }

async changeIP(): Promise<{ success: boolean; oldIP: string | null; newIP: string | null; message: string }> {
    try {
      const oldIP = await this.getCurrentIP(CONNECTION.TOR);
      console.log("Debug: Got old IP:", oldIP);
      
      await this.connect();
      console.log("Debug: Connected to control port");
      
      await this.authenticate();
      console.log("Debug: Authenticated");
      
      const response = await this.sendCommand("SIGNAL NEWNYM");
      console.log("Debug: NEWNYM response:", response.trim());
      
      if (!response.startsWith("250")) {
        return {
          success: false,
          oldIP,
          newIP: null,
          message: `Failed to request new circuit: ${response.trim()}`
        };
      }
      
      console.log("Debug: Waiting for circuit ready...");
      await this.waitForCircuitReady();
      console.log("Debug: Circuit ready, forcing new connection");
      
      this.proxiedClient?.close();
      this.proxiedClient = Deno.createHttpClient({
        proxy: {
          url: Deno.env.get('HTTPS_PROXY') ??  `socks5://${this.host}:${this.socksPort}`
        } 
      });
      
      const newIP = await this.getCurrentIP(CONNECTION.TOR);
      console.log("Debug: Got new IP:", newIP);
      
      const success = newIP !== null && newIP !== oldIP;
      
      return {
        success,
        oldIP,
        newIP,
        message: success 
          ? "IP changed successfully" 
          : newIP === oldIP 
            ? "IP change requested but same IP returned" 
            : "Failed to get new IP"
      };
      
    } catch (error) {
      console.log("Debug: Error in changeIP:", error);
      return {
        success: false,
        oldIP: null,
        newIP: null,
        message: `Error changing IP: ${error}`
      };
    } finally {
      if (this.conn) {
        this.conn.close();
        this.conn = null;
      }
    }
  }
}
  
export { TorController, CONNECTION };
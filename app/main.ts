import { TorController, CONNECTION } from "./tor_control.ts";

if (import.meta.main) {
  console.log("Starting Tor controller...");
  const controller = new TorController("tor-proxy", 9050, 9051, "");
  
  // Using TOR (default)
  const torIP = await controller.getCurrentIP();
  console.log("TOR IP:", torIP);

    // Using TOR (default)
  const torIPExplicit = await controller.getCurrentIP(CONNECTION.TOR);
  console.log("TOR IP Explicit:", torIPExplicit);
  
  // Using normal connection
  const normalIP = await controller.getCurrentIP(CONNECTION.NORMAL);
  console.log("Normal IP:", normalIP);

  console.log("Changing IP....");
  const result = await controller.changeIP();
  console.log(`IP Change: ${result.success ? 'Success' : 'Failed'}`);
  console.log(`Old IP: ${result.oldIP}`);
  console.log(`New IP: ${result.newIP}`);
  console.log(`Message: ${result.message}`);
}
// Creates and incrementally analyzes a verified SH-2 function boundary.

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;

public class SeedSfiii3Function extends GhidraScript {

	@Override
	public void run() throws Exception {
		String[] arguments = getScriptArgs();
		if (arguments.length != 2) {
			printerr("Usage: SeedSfiii3Function.java <address> <name>");
			return;
		}
		Address entry = toAddr(Long.decode(arguments[0]));
		disassemble(entry);
		if (getFunctionAt(entry) == null) {
			createFunction(entry, arguments[1]);
		}
		analyzeChanges(currentProgram);
		println("seeded_function=0x" + String.format("%08X", entry.getOffset()));
	}
}
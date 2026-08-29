// Decompiles one discovered sfiii3 function into a caller-specified text file.

import java.io.File;
import java.io.FileWriter;

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;

public class DecompileSfiii3Function extends GhidraScript {

	@Override
	public void run() throws Exception {
		String[] arguments = getScriptArgs();
		if (arguments.length != 2) {
			printerr("Usage: DecompileSfiii3Function.java <address> <output-path>");
			return;
		}
		Function function = getFunctionAt(toAddr(Long.decode(arguments[0])));
		if (function == null) {
			printerr("No function at " + arguments[0]);
			return;
		}

		DecompInterface decompiler = new DecompInterface();
		decompiler.openProgram(currentProgram);
		DecompileResults result = decompiler.decompileFunction(function, 60, monitor);
		if (!result.decompileCompleted()) {
			printerr("Decompilation failed: " + result.getErrorMessage());
			return;
		}

		try (FileWriter writer = new FileWriter(new File(arguments[1]))) {
			writer.write(result.getDecompiledFunction().getC());
		}
		println("decompiled=0x" + String.format("%08X", function.getEntryPoint().getOffset()));
		println("output=" + arguments[1]);
	}
}
// Reports direct caller and callee relationships for specified sfiii3 functions.

import java.util.Set;

import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;

public class ReportSfiii3Relations extends GhidraScript {

	private void printFunctions(String relationship, Set<Function> functions) {
		for (Function function : functions) {
			println(String.format("%s=0x%08X %s", relationship,
				function.getEntryPoint().getOffset(), function.getName()));
		}
	}

	@Override
	public void run() throws Exception {
		String[] targets = getScriptArgs();
		if (targets.length == 0) {
			printerr("Specify one or more function addresses.");
			return;
		}
		for (String target : targets) {
			Function function = getFunctionAt(toAddr(Long.decode(target)));
			if (function == null) {
				printerr("No function at " + target);
				continue;
			}
			println(String.format("function=0x%08X %s", function.getEntryPoint().getOffset(),
				function.getName()));
			printFunctions("caller", function.getCallingFunctions(monitor));
			printFunctions("callee", function.getCalledFunctions(monitor));
		}
	}
}
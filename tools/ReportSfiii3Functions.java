// Prints a bounded inventory of functions currently discovered in the sfiii3 program.

import ghidra.app.script.GhidraScript;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.FunctionIterator;

public class ReportSfiii3Functions extends GhidraScript {

	@Override
	public void run() throws Exception {
		FunctionIterator functions = currentProgram.getFunctionManager().getFunctions(true);
		int count = 0;
		while (functions.hasNext()) {
			Function function = functions.next();
			count++;
			if (count <= 200) {
				println(String.format("function=0x%08X name=%s size=%d", 
					function.getEntryPoint().getOffset(), function.getName(),
					function.getBody().getNumAddresses()));
			}
		}
		println("function_count=" + count);
	}
}
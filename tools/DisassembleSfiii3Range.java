// Disassembles and prints a bounded SH-2 instruction range for targeted analysis.

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.InstructionIterator;

public class DisassembleSfiii3Range extends GhidraScript {

	@Override
	public void run() throws Exception {
		String[] arguments = getScriptArgs();
		if (arguments.length != 2) {
			printerr("Usage: DisassembleSfiii3Range.java <address> <instruction-count>");
			return;
		}
		Address start = toAddr(Long.decode(arguments[0]));
		int count = Integer.decode(arguments[1]);
		disassemble(start);
		InstructionIterator instructions = currentProgram.getListing().getInstructions(start, true);
		for (int index = 0; index < count && instructions.hasNext(); index++) {
			Instruction instruction = instructions.next();
			println(String.format("0x%08X %s", instruction.getAddress().getOffset(), instruction));
		}
	}
}
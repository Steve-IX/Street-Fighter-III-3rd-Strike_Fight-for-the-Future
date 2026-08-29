// Seeds SH-2 analysis from valid reset and interrupt-vector targets.

import java.util.HashSet;
import java.util.Set;

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.Function;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.symbol.SourceType;

public class SeedSfiii3Vectors extends GhidraScript {

	private static final long PROGRAM_START = 0x06000000L;
	private static final long PROGRAM_END = 0x06ffffffL;
	private static final int VECTOR_COUNT = 256;

	@Override
	public void run() throws Exception {
		Memory memory = currentProgram.getMemory();
		Set<Long> targets = new HashSet<>();
		for (int vector = 0; vector < VECTOR_COUNT; vector++) {
			Address vectorAddress = toAddr(PROGRAM_START + vector * 4L);
			long target = Integer.toUnsignedLong(memory.getInt(vectorAddress));
			if (target < PROGRAM_START || target > PROGRAM_END || (target & 1) != 0) {
				continue;
			}
			println("vector=" + vector + " target=0x" + String.format("%08X", target));
			targets.add(target);
			Address targetAddress = toAddr(target);
			disassemble(targetAddress);
			if (getFunctionAt(targetAddress) == null) {
				createFunction(targetAddress, "vector_target_" + String.format("%03d", vector));
			}
		}

		analyzeChanges(currentProgram);
		int functions = 0;
		for (long target : targets) {
			Function function = getFunctionAt(toAddr(target));
			if (function != null) {
				functions++;
			}
		}
		println("valid_vector_targets=" + targets.size());
		println("vector_target_functions=" + functions);
	}
}
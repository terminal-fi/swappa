export const SwappaErrorType = {
    MathError: "MathError",
    HydrationError: "HydrationError",
} as const

export type SwappaErrorTypeValue = typeof SwappaErrorType[keyof typeof SwappaErrorType];

export class SwappaError<EType extends SwappaErrorTypeValue | unknown> extends Error {

    constructor(private readonly _type: EType, message: string) {
        super(`Swappa${_type}: ${message}`);
    }

    public get type(): EType {
        return this._type;
    }

    public static is(e: unknown): e is SwappaError<SwappaErrorTypeValue> {
        if (!e || !(typeof e === 'object') || Array.isArray(e)) return false;
        return 'type' in e && typeof e.type === 'string' && e.type in SwappaErrorType;
    }
}

export class SwappaMathError extends SwappaError<typeof SwappaErrorType.MathError> {
    constructor(message: string) {
        super(SwappaErrorType.MathError, message);
    }

    public static is(e: unknown): e is SwappaMathError {
        return SwappaError.is(e) && e.type === SwappaErrorType.MathError;
    }
}

export class SwappaHydrationError extends SwappaError<typeof SwappaErrorType.HydrationError> {
    constructor(message: string) {
        super(SwappaErrorType.HydrationError, message);
    }

    public static is(e: unknown): e is SwappaHydrationError {
        return SwappaError.is(e) && e.type === SwappaErrorType.HydrationError;
    }
}
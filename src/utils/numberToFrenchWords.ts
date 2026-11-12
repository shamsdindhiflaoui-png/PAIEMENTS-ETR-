/**
 * Conversion d'un montant numérique en toutes lettres en français
 * Conforme aux règles orthographiques et financières
 */

const UNITES = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
const DIZAINES = ['', 'dix', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
const PARTICULIERS: Record<number, string> = {
  11: 'onze',
  12: 'douze',
  13: 'treize',
  14: 'quatorze',
  15: 'quinze',
  16: 'seize',
  71: 'soixante-et-onze',
  72: 'soixante-douze',
  73: 'soixante-treize',
  74: 'soixante-quatorze',
  75: 'soixante-quinze',
  76: 'soixante-seize',
  91: 'quatre-vingt-onze',
  92: 'quatre-vingt-douze',
  93: 'quatre-vingt-treize',
  94: 'quatre-vingt-quatorze',
  95: 'quatre-vingt-quinze',
  96: 'quatre-vingt-seize',
};

function convertLessThanHundred(n: number): string {
  if (n === 0) return '';
  if (n < 10) return UNITES[n];
  if (PARTICULIERS[n]) return PARTICULIERS[n];

  const d = Math.floor(n / 10);
  const u = n % 10;

  if (d === 1) {
    return 'dix-' + UNITES[u];
  }
  if (d === 7) {
    return 'soixante-' + (u === 1 ? 'et-onze' : convertLessThanHundred(10 + u));
  }
  if (d === 8) {
    if (u === 0) return 'quatre-vingts';
    return 'quatre-vingt-' + UNITES[u];
  }
  if (d === 9) {
    return 'quatre-vingt-' + convertLessThanHundred(10 + u);
  }

  if (u === 0) return DIZAINES[d];
  if (u === 1) return DIZAINES[d] + '-et-un';
  return DIZAINES[d] + '-' + UNITES[u];
}

function convertLessThanThousand(n: number): string {
  if (n === 0) return '';
  const c = Math.floor(n / 100);
  const r = n % 100;

  let centStr = '';
  if (c === 1) {
    centStr = 'cent';
  } else if (c > 1) {
    centStr = UNITES[c] + (r === 0 ? ' cents' : ' cent');
  }

  const rStr = convertLessThanHundred(r);

  if (centStr && rStr) {
    return centStr + ' ' + rStr;
  }
  return centStr || rStr;
}

function convertIntegerToWords(n: number): string {
  if (n === 0) return 'zéro';
  if (n < 0) return 'moins ' + convertIntegerToWords(Math.abs(n));

  const milliards = Math.floor(n / 1_000_000_000);
  let reste = n % 1_000_000_000;
  const millions = Math.floor(reste / 1_000_000);
  reste %= 1_000_000;
  const milliers = Math.floor(reste / 1_000);
  const unites = reste % 1_000;

  const parts: string[] = [];

  if (milliards > 0) {
    if (milliards === 1) {
      parts.push('un milliard');
    } else {
      parts.push(convertLessThanThousand(milliards) + ' milliards');
    }
  }

  if (millions > 0) {
    if (millions === 1) {
      parts.push('un million');
    } else {
      parts.push(convertLessThanThousand(millions) + ' millions');
    }
  }

  if (milliers > 0) {
    if (milliers === 1) {
      parts.push('mille');
    } else {
      parts.push(convertLessThanThousand(milliers) + ' mille');
    }
  }

  if (unites > 0) {
    parts.push(convertLessThanThousand(unites));
  }

  return parts.join(' ').trim();
}

const CURRENCY_NAMES: Record<string, { singular: string; plural: string; centSingular: string; centPlural: string; decimals: number }> = {
  EUR: { singular: 'euro', plural: 'euros', centSingular: 'centime', centPlural: 'centimes', decimals: 2 },
  USD: { singular: 'dollar américain', plural: 'dollars américains', centSingular: 'cent', centPlural: 'cents', decimals: 2 },
  GBP: { singular: 'livre sterling', plural: 'livres sterling', centSingular: 'penny', centPlural: 'pence', decimals: 2 },
  CHF: { singular: 'franc suisse', plural: 'francs suisses', centSingular: 'centime', centPlural: 'centimes', decimals: 2 },
  CAD: { singular: 'dollar canadien', plural: 'dollars canadiens', centSingular: 'cent', centPlural: 'cents', decimals: 2 },
  JPY: { singular: 'yen', plural: 'yens', centSingular: 'sen', centPlural: 'sens', decimals: 0 },
  TND: { singular: 'dinar tunisien', plural: 'dinars tunisiens', centSingular: 'millime', centPlural: 'millimes', decimals: 3 },
};

export function numberToFrenchWords(amount: number, currency: string = 'EUR'): string {
  if (isNaN(amount)) return '';
  const info = CURRENCY_NAMES[currency] || {
    singular: currency,
    plural: currency,
    centSingular: 'centime',
    centPlural: 'centimes',
    decimals: 2,
  };

  const integerPart = Math.floor(Math.abs(amount));
  const factor = Math.pow(10, info.decimals);
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * factor);

  const integerWords = convertIntegerToWords(integerPart);
  const currencyStr = integerPart <= 1 ? info.singular : info.plural;

  let result = `${integerWords} ${currencyStr}`;

  if (info.decimals > 0 && decimalPart > 0) {
    const decimalWords = convertIntegerToWords(decimalPart);
    const centStr = decimalPart <= 1 ? info.centSingular : info.centPlural;
    result += ` et ${decimalWords} ${centStr}`;
  }

  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

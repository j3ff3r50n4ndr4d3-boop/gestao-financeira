/* ══════════════ Catálogo ÉLAN ══════════════ */
const PRODUCTS = [
  {
    id: "blazer-aura",
    name: "Blazer Aura",
    cat: "roupas",
    price: 389.9,
    old: 459.9,
    img: "assets/img/blazer.jpg",
    tag: "Best-seller",
    stock: 5,
    rating: 4.9,
    reviews: 127,
    sizes: ["PP", "P", "M", "G", "GG"],
    desc: "Alfaiataria premium com ombreira suave, forro acetinado e caimento impecável. Tecido com toque de elastano para conforto absoluto do escritório ao jantar."
  },
  {
    id: "vestido-lune",
    name: "Vestido Lune",
    cat: "roupas",
    price: 459.9,
    old: null,
    img: "assets/img/vestido.jpg",
    tag: "Novo",
    stock: 12,
    rating: 5.0,
    reviews: 89,
    sizes: ["PP", "P", "M", "G"],
    desc: "Seda acetinada com corte enviesado que acompanha o corpo. Alças finas reguláveis e comprimento midi — a peça mais desejada da coleção."
  },
  {
    id: "camiseta-essencial",
    name: "T-shirt Essencial",
    cat: "roupas",
    price: 129.9,
    old: 159.9,
    img: "assets/img/camiseta.jpg",
    tag: "-19%",
    stock: 30,
    rating: 4.8,
    reviews: 342,
    sizes: ["P", "M", "G", "GG"],
    desc: "Algodão pima de alta gramatura, modelagem oversized e gola que não deforma. O básico perfeito que sustenta qualquer look."
  },
  {
    id: "jeans-rio",
    name: "Wide Leg Rio",
    cat: "roupas",
    price: 279.9,
    old: null,
    img: "assets/img/jeans.jpg",
    tag: null,
    stock: 8,
    rating: 4.7,
    reviews: 214,
    sizes: ["36", "38", "40", "42", "44"],
    desc: "Cintura alta, perna ampla e lavagem clara atemporal. Denim encorpado com caimento fluido — alonga a silhueta sem esforço."
  },
  {
    id: "camisa-brisa",
    name: "Camisa Brisa",
    cat: "roupas",
    price: 219.9,
    old: null,
    img: "assets/img/linho.jpg",
    tag: "Novo",
    stock: 15,
    rating: 4.9,
    reviews: 98,
    sizes: ["P", "M", "G"],
    desc: "Linho puro com toque macio e respirabilidade natural. Modelagem solta, botões de madrepérola e aquele ar de elegância despretensiosa."
  },
  {
    id: "conjunto-nude",
    name: "Conjunto Tricô Nude",
    cat: "roupas",
    price: 329.9,
    old: 389.9,
    img: "assets/img/trico.jpg",
    tag: "Últimas peças",
    stock: 3,
    rating: 4.9,
    reviews: 76,
    sizes: ["Único"],
    desc: "Cropped + saia em tricô canelado com elastano. Conforto de loungewear com presença de look pronto — veste do 36 ao 44."
  },
  {
    id: "bolsa-essenza",
    name: "Bolsa Essenza",
    cat: "acessorios",
    price: 499.9,
    old: 599.9,
    img: "assets/img/bolsa.jpg",
    tag: "Best-seller",
    stock: 7,
    rating: 5.0,
    reviews: 164,
    sizes: ["Único"],
    desc: "Couro legítimo caramelo com ferragens douradas e alça ajustável. Estrutura firme, interior forrado e espaço para o essencial do dia."
  },
  {
    id: "brinco-gota",
    name: "Brincos Gota",
    cat: "acessorios",
    price: 149.9,
    old: null,
    img: "assets/img/brincos.jpg",
    tag: null,
    stock: 20,
    rating: 4.8,
    reviews: 131,
    sizes: ["Único"],
    desc: "Banho de ouro 18k com acabamento polido e hipoalergênico. Leves, atemporais e prontos para elevar qualquer produção."
  }
];

const TESTIMONIALS = [
  {
    quote: "O caimento é surreal. Comprem o Blazer Aura sem medo — uso toda semana e recebo elogios sempre.",
    name: "Mariana C.",
    city: "Belo Horizonte · MG",
    rating: 5
  },
  {
    quote: "Entrega chegou antes do prazo e a qualidade do tecido superou marcas que cobram o triplo. Virei cliente fiel.",
    name: "Fernanda R.",
    city: "São Paulo · SP",
    rating: 5
  },
  {
    quote: "Precisei trocar o tamanho e o processo foi absurdamente fácil, sem custo nenhum. Atendimento nota 10.",
    name: "Júlia M.",
    city: "Montes Claros · MG",
    rating: 5
  }
];

/* Depoimentos usados na prova social flutuante */
const SOCIAL_PROOF = [
  { name: "Ana S. · São Paulo/SP", product: "vestido-lune", time: "há 8 minutos" },
  { name: "Beatriz L. · Belo Horizonte/MG", product: "blazer-aura", time: "há 23 minutos" },
  { name: "Camila F. · Rio de Janeiro/RJ", product: "bolsa-essenza", time: "há 41 minutos" },
  { name: "Larissa P. · Montes Claros/MG", product: "conjunto-nude", time: "há 1 hora" },
  { name: "Renata V. · Curitiba/PR", product: "camisa-brisa", time: "há 2 horas" },
  { name: "Paula M. · Salvador/BA", product: "jeans-rio", time: "há 3 horas" }
];

const FREE_SHIPPING_MIN = 299;
const SHIPPING_STANDARD = 19.9;
const SHIPPING_EXPRESS = 34.9;
const COUPON = { code: "BEMVINDA10", percent: 10 };
const PIX_DISCOUNT = 0.05;
const MIN_INSTALLMENT = 30;
const MAX_INSTALLMENTS = 12;

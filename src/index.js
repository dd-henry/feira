const express = require("express");
const mongoose = require("mongoose");
const mongooseSequence = require("mongoose-sequence");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const port = 3001;

// Conexão com o MongoDB
mongoose.connect(
  "mongodb+srv://henry:CHORUmaca32@primeiraapi.x5fg5.mongodb.net/?retryWrites=true&w=majority&appName=primeiraapi"
);

mongoose.connection.on("connected", () => {
  console.log("Conectado ao MongoDB");
});

// Definindo o esquema do Item
const ItemSchema = new mongoose.Schema({
  name: String,
  description: String,
  imgUrl: String,
  owner: String,
});
ItemSchema.plugin(mongooseSequence(mongoose), { inc_field: "itemId" });
const Item = mongoose.model("Item", ItemSchema); // Modelo "Item"

// Definindo o esquema do Feirante
const FeiranteSchema = new mongoose.Schema({
  name: String,
  password: String,
  inventory: [ItemSchema], // Inventário de itens
});

FeiranteSchema.plugin(mongooseSequence(mongoose), { inc_field: "feiranteId" });
const Feirante = mongoose.model("Feirante", FeiranteSchema); // Modelo "Feirante"

// Definindo o esquema da Proposta
const ProposalSchema = new mongoose.Schema({
  proposingItem: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  receivingItem: { type: mongoose.Schema.Types.ObjectId, ref: "Item" },
  status: { type: String, default: "Pendente" }, // Pode ser 'Pendente', 'Aceita' ou 'Recusada'
  createdAt: { type: Date, default: Date.now },
});

const Proposal = mongoose.model("Proposal", ProposalSchema); // Criando o modelo Proposal

// Rota GET
app.get("/", (req, res) => {
  res.send("Servidor rodando");
});

// Rota POST -> Criar feirante
app.post("/postfeirante", async (req, res) => {
  const feirante = new Feirante({
    name: req.body.name,
    password: req.body.password,
    inventory: req.body.inventory || [], // Garante que o inventário comece vazio se não for fornecido
  });

  try {
    const savedFeirante = await feirante.save();
    res.status(201).send(savedFeirante); // Retorna o feirante criado com status 201
  } catch (error) {
    console.error("Erro ao salvar feirante:", error);
    res.status(500).send("Erro ao salvar feirante"); // Responde com erro
  }
});

// Rota POST -> Criar item
app.post("/postitem", async (req, res) => {
  const item = new Item({
    name: req.body.name,
    description: req.body.description,
    imgUrl: req.body.imgUrl,
    owner: req.body.owner,
  });

  try {
    const savedItem = await item.save();
    return res.status(201).send(savedItem); // Retorna o item criado com status 201
  } catch (error) {
    console.error("Erro ao salvar item:", error);
    return res.status(500).send("Erro ao salvar item"); // Responde com erro
  }
});

// Rota GET -> Listar todos os itens
app.get("/getitems", async (req, res) => {
  const items = await Item.find();
  return res.send(items);
});

// Rota GET -> Listar itens por feirante
app.get("/getitemsbytrader", async (req, res) => {
  const items = await Item.find({ owner: req.body.owner });
  return res.send(items);
});

// Rota GET -> Listar todos os feirantes
app.get("/gettraders", async (req, res) => {
  const feirantes = await Feirante.find();
  return res.send(feirantes);
});

// Rota DELETE -> Deletar feirante
app.delete("/deletetrader", async (req, res) => {
  const feirante = await Feirante.findOneAndDelete({ name: req.body.name });
  return res.send(feirante);
});

// Rota DELETE -> Deletar item
app.delete("/deleteitem", async (req, res) => {
  const item = await Item.findOneAndDelete({ name: req.body.name });
  return res.send(item);
});

// Rota PUT -> Editar item (mudar dono)
app.put("/edititem", async (req, res) => {
  const item = await Item.findOneAndUpdate(
    { name: req.body.name },
    { owner: req.body.newowner },
    { new: true }
  );
  return res.send(item);
});

// Rota POST -> Criar proposta de troca
app.post("/propose-trade", async (req, res) => {
  const { proposingItem, receivingItem } = req.body;

  // Verificar se os dados estão presentes
  if (!proposingItem || !receivingItem) {
    return res
      .status(400)
      .json({ success: false, message: "Dados da troca incompletos" });
  }

  try {
    // 1. Buscar os dois itens no banco de dados usando o nome e o owner
    const itemA = await Item.findOne({
      name: proposingItem.name,
      owner: proposingItem.owner,
    });

    const itemB = await Item.findOne({
      name: receivingItem.name,
      owner: receivingItem.owner,
    });

    // 2. Verificar se os dois itens foram encontrados
    if (!itemA) {
      return res.status(404).json({
        success: false,
        message: `Item proposto '${proposingItem.name}' do dono '${proposingItem.owner}' não foi encontrado`,
      });
    }

    if (!itemB) {
      return res.status(404).json({
        success: false,
        message: `Item recebido '${receivingItem.name}' do dono '${receivingItem.owner}' não foi encontrado`,
      });
    }

    // 3. Criar a proposta de troca
    const proposal = new Proposal({
      proposingItem: itemA._id, // Armazenar o ID do item proposto
      receivingItem: itemB._id, // Armazenar o ID do item recebido
      status: "Pendente",
    });

    await proposal.save();

    return res.status(201).json({
      success: true,
      message: "Proposta de troca criada com sucesso!",
    });
  } catch (error) {
    console.error("Erro ao criar a proposta de troca:", error);
    return res
      .status(500)
      .json({ success: false, message: "Erro ao criar a proposta de troca" });
  }
});

// Rota para obter todas as propostas pendentes
app.get("/proposals", async (req, res) => {
  try {
    const proposals = await Proposal.find({ status: "Pendente" })
      .populate("proposingItem")
      .populate("receivingItem");
    return res.status(200).json(proposals);
  } catch (error) {
    console.error("Erro ao buscar propostas:", error);
    return res
      .status(500)
      .json({ success: false, message: "Erro ao buscar propostas" });
  }
});

// Rota POST -> Aceitar proposta de troca
app.post("/accept-trade/", async (req, res) => {
  try {
    // Buscar a proposta de troca pelo ID
    const trade = await Proposal.findById(req.body.tradeId).populate(
      "proposingItem receivingItem proposingFeirante receivingFeirante"
    );

    if (!trade) {
      return res
        .status(404)
        .json({ success: false, message: "Proposta de troca não encontrada" });
    }

    // Trocar os donos dos itens
    const tempOwner = trade.proposingItem.owner;
    trade.proposingItem.owner = trade.receivingItem.owner;
    trade.receivingItem.owner = tempOwner;

    // Salvar os itens com os novos donos
    await trade.proposingItem.save();
    await trade.receivingItem.save();

    // Atualizar o status da troca
    trade.status = "accepted";
    await trade.save();

    return res
      .status(200)
      .json({ success: true, message: "Troca realizada com sucesso!", trade });
  } catch (error) {
    console.error("Erro ao aceitar a troca:", error);
    return res
      .status(500)
      .json({ success: false, message: "Erro ao aceitar a troca", error });
  }
});

// Iniciando o servidor
app.listen(port, () => {
  console.log("Servidor rodando na porta", port);
});

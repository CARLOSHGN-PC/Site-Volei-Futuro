<section id="shop-page">
    <h2>Nossa Loja</h2>
    <p>Adquira os produtos oficiais do Volei Futuro e ajude a apoiar nosso projeto!</p>

    <div class="product-grid">
        <?php
        // Simulação de um banco de dados de produtos
        $products = [
            [
                'id' => 1,
                'name' => 'Camisa Oficial do Time (Azul)',
                'price' => 'R$ 89,90',
                'image' => 'assets/images/placeholder_camisa_azul.png',
                'slug' => 'camisa-oficial-azul'
            ],
            [
                'id' => 2,
                'name' => 'Camisa Oficial do Time (Branca)',
                'price' => 'R$ 89,90',
                'image' => 'assets/images/placeholder_camisa_branca.png',
                'slug' => 'camisa-oficial-branca'
            ],
            [
                'id' => 3,
                'name' => 'Boné Volei Futuro',
                'price' => 'R$ 49,90',
                'image' => 'assets/images/placeholder_bone.png',
                'slug' => 'bone-volei-futuro'
            ],
            [
                'id' => 4,
                'name' => 'Garrafa de Água Personalizada',
                'price' => 'R$ 35,00',
                'image' => 'assets/images/placeholder_garrafa.png',
                'slug' => 'garrafa-agua'
            ]
        ];

        // Loop para exibir cada produto
        foreach ($products as $product) {
            echo '<div class="product-card">';
            echo '<a href="index.php?page=single-product&slug=' . htmlspecialchars($product['slug']) . '">';
            echo '<img src="' . htmlspecialchars($product['image']) . '" alt="' . htmlspecialchars($product['name']) . '">';
            echo '<h3>' . htmlspecialchars($product['name']) . '</h3>';
            echo '<p class="price">' . htmlspecialchars($product['price']) . '</p>';
            echo '</a>';
            echo '<a href="index.php?page=cart&action=add&id=' . $product['id'] . '" class="add-to-cart-button">Adicionar ao Carrinho</a>';
            echo '</div>';
        }
        ?>
    </div>
</section>
